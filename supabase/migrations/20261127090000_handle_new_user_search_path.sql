-- handle_new_user() runs as SECURITY DEFINER from the auth.users trigger.
-- Pin its search_path so object lookups cannot be redirected through a
-- schema earlier on the caller's path.
ALTER FUNCTION public.handle_new_user() SET search_path = public;
