-- Fix infinite recursion in profiles RLS policy
-- Create a SECURITY DEFINER function that bypasses RLS to check user's role

CREATE OR REPLACE FUNCTION public.user_has_role(target_role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = target_role
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_any_role(VARIADIC target_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = ANY(target_roles)
  );
$$;

-- Update the profiles policy to use the new function
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles"
  ON profiles FOR ALL
  USING (public.user_has_role('admin'));

-- Also update the leads policies to use the new function to avoid similar issues
DROP POLICY IF EXISTS "Admin, backend, and counselor can view all leads" ON leads;
CREATE POLICY "Admin, backend, and counselor can view all leads"
  ON leads FOR SELECT
  USING (public.user_has_any_role('admin', 'backend', 'counselor'));

DROP POLICY IF EXISTS "Admin, backend, and counselor can update leads" ON leads;
CREATE POLICY "Admin, backend, and counselor can update leads"
  ON leads FOR UPDATE
  USING (
    public.user_has_any_role('admin', 'backend', 'counselor')
    OR auth.uid() = assigned_to
  );
