<?php
/**
 * Craftoo file storage: https://nayanfood.in/craftoo/files/<name>
 *
 *   GET / HEAD  /files/<name>   public, so <img> tags and links work (browsers send no Origin
 *                               header for these, which is why an Origin check blocks images)
 *   PUT / POST  /files/<name>   upload; needs the X-API-Key header
 *   DELETE      /files/<name>   delete; needs the X-API-Key header
 *
 * The Next.js server uploads with the same key (FILE_STORAGE_API_KEY). The key never goes to
 * browsers. Set it below via an environment variable, or in a file OUTSIDE the web root.
 */

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------

/** Only these files can be stored or served. Never allow php, html, svg or js. */
$allowedExtensions = [
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'webp' => 'image/webp',
    'gif'  => 'image/gif',
    'avif' => 'image/avif',
];

$maxBytes = 15 * 1024 * 1024; // 15 MB

/**
 * The upload key: a long random string (e.g. `openssl rand -hex 32`). Read from the
 * FILE_STORAGE_API_KEY environment variable, or from a one-line file outside the web root.
 */
function uploadKey(): string
{
    // Ignore spaces, line breaks, quotes and a UTF-8 BOM (Notepad adds one), which would
    // otherwise make a correct-looking key fail to match.
    $clean = static function (string $value): string {
        $value = preg_replace('/^\xEF\xBB\xBF/', '', $value);
        return trim($value, " \t\n\r\0\x0B\"'");
    };

    $key = getenv('FILE_STORAGE_API_KEY');
    if (is_string($key) && $clean($key) !== '') {
        return $clean($key);
    }
    // Adjust this path for your hosting; it must NOT be inside public_html.
    $keyFile = dirname(__DIR__, 3) . '/craftoo-file-storage.key';
    if (is_readable($keyFile)) {
        return $clean((string) file_get_contents($keyFile));
    }
    return '';
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function sendJson(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    echo json_encode($body);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Public files: any site may load them. Uploads happen server to server, so no CORS is needed
// for them, and the Origin header is never used for security (anyone can fake it).
header('Access-Control-Allow-Origin: *');
header('X-Content-Type-Options: nosniff');

if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

if (!in_array($method, ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'], true)) {
    header('Allow: GET, HEAD, PUT, POST, DELETE, OPTIONS');
    sendJson(405, ['error' => 'Method not allowed']);
}

// -----------------------------------------------------------------------------
// File name: a plain name with an allowed extension, e.g. 3f2a....jpg
// -----------------------------------------------------------------------------

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
$storedFileName = rawurldecode(basename($requestPath));

if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.([A-Za-z0-9]+)$/', $storedFileName, $match)) {
    sendJson(400, ['error' => 'Invalid file name']);
}
$extension = strtolower($match[1]);
if (!isset($allowedExtensions[$extension])) {
    // Also stops this script, its key or any other non-image file from being read or replaced.
    sendJson(400, ['error' => 'File type not allowed']);
}

$uploadDir = __DIR__;
$filePath = $uploadDir . DIRECTORY_SEPARATOR . $storedFileName;

// -----------------------------------------------------------------------------
// GET / HEAD: serve the file (public)
// -----------------------------------------------------------------------------

if ($method === 'GET' || $method === 'HEAD') {
    if (!is_file($filePath)) {
        sendJson(404, ['error' => 'File not found']);
    }
    header('Content-Type: ' . $allowedExtensions[$extension]);
    header('Content-Length: ' . filesize($filePath));
    header('Content-Disposition: inline; filename="' . $storedFileName . '"');
    // Names are random and never reused, so browsers and WhatsApp can cache them for good.
    header('Cache-Control: public, max-age=31536000, immutable');
    if ($method === 'GET') {
        readfile($filePath);
    }
    exit;
}

// -----------------------------------------------------------------------------
// Everything below changes files: require the upload key
// -----------------------------------------------------------------------------

$expectedKey = uploadKey();
if ($expectedKey === '') {
    sendJson(500, ['error' => 'Upload key is not configured on the file server']);
}
$givenKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if (!is_string($givenKey) || !hash_equals($expectedKey, $givenKey)) {
    sendJson(401, ['error' => 'Unauthorized']);
}

// -----------------------------------------------------------------------------
// PUT / POST: upload
// -----------------------------------------------------------------------------

if ($method === 'PUT' || $method === 'POST') {
    $declared = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($declared > $maxBytes) {
        sendJson(413, ['error' => 'File is too large']);
    }

    $input = fopen('php://input', 'rb');
    $tempPath = $uploadDir . DIRECTORY_SEPARATOR . '.upload-' . bin2hex(random_bytes(8)) . '.tmp';
    $output = $input ? fopen($tempPath, 'wb') : false;
    if ($input === false || $output === false) {
        sendJson(500, ['error' => 'Unable to save file']);
    }

    // Copy at most one byte over the limit, so an oversized body is caught without a size header.
    $bytesWritten = stream_copy_to_stream($input, $output, $maxBytes + 1);
    fclose($input);
    fclose($output);

    if ($bytesWritten === false || $bytesWritten === 0) {
        @unlink($tempPath);
        sendJson(400, ['error' => 'Empty or unreadable file']);
    }
    if ($bytesWritten > $maxBytes) {
        @unlink($tempPath);
        sendJson(413, ['error' => 'File is too large']);
    }

    // The content must really be an image of the kind its name says.
    $detected = (new finfo(FILEINFO_MIME_TYPE))->file($tempPath);
    if ($detected !== $allowedExtensions[$extension]) {
        @unlink($tempPath);
        sendJson(415, ['error' => 'File content does not match its type']);
    }

    if (!rename($tempPath, $filePath)) {
        @unlink($tempPath);
        sendJson(500, ['error' => 'Unable to save file']);
    }

    sendJson(200, [
        'success' => true,
        'storedFileName' => $storedFileName,
        'fileSize' => $bytesWritten,
        'url' => 'https://nayanfood.in/craftoo/files/' . rawurlencode($storedFileName),
    ]);
}

// -----------------------------------------------------------------------------
// DELETE
// -----------------------------------------------------------------------------

if ($method === 'DELETE') {
    if (!is_file($filePath)) {
        sendJson(404, ['error' => 'File not found']);
    }
    if (!unlink($filePath)) {
        sendJson(500, ['error' => 'Unable to delete file']);
    }
    sendJson(200, ['success' => true, 'storedFileName' => $storedFileName]);
}
