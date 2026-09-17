-- 1) Extend handle_new_user to also insert roles from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_text text;
BEGIN
  -- Create profile if not exists
  INSERT INTO public.profiles (id, user_id, email, name)
  VALUES (gen_random_uuid(), NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT DO NOTHING;

  -- Insert roles from raw_user_meta_data (supports either roles array or single role)
  IF (NEW.raw_user_meta_data ? 'roles') THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT NEW.id, r::app_role
    FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'roles') AS t(r)
    WHERE r IN ('admin','interviewer','interviewee')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF (NEW.raw_user_meta_data ? 'role') THEN
    role_text := NEW.raw_user_meta_data->>'role';
    IF role_text IN ('admin','interviewer','interviewee') THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, role_text::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Create trigger to run the function on new auth.users row (if not already present)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();