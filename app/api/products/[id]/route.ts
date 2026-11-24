import { ProductService } from '@/services/product.service'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await ProductService.getProductById(id)
  if (error) return Response.json({ error: (error as any).message }, { status: 404 })
  return Response.json({ data })
}
