-- Create CV storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', false);

-- Create RLS policies for CV bucket
CREATE POLICY "Users can upload their own CVs" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'cvs' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own CVs" ON storage.objects
FOR SELECT USING (
  bucket_id = 'cvs' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own CVs" ON storage.objects
FOR DELETE USING (
  bucket_id = 'cvs' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);