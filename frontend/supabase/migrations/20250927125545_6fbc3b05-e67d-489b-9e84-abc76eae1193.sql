-- Create a storage bucket for CV uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cvs', 'cvs', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the CV storage bucket
CREATE POLICY "Allow public uploads to cvs bucket" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'cvs');

CREATE POLICY "Allow public reads from cvs bucket" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'cvs');

CREATE POLICY "Allow public updates to cvs bucket" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'cvs');

CREATE POLICY "Allow public deletes from cvs bucket" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'cvs');