-- Allow users to insert their own roles during signup
-- Note: In production, consider having admin approval for 'admin' role
CREATE POLICY "Users can insert their own roles during signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);