
-- Create private bucket for temporary NF-e PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('nfe-pdfs', 'nfe-pdfs', false);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload NF-e PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'nfe-pdfs' AND auth.role() = 'authenticated');

-- Allow service role to read (for edge function download)
CREATE POLICY "Service role can read NF-e PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'nfe-pdfs');

-- Allow service role to delete (cleanup after sending)
CREATE POLICY "Service role can delete NF-e PDFs"
ON storage.objects FOR DELETE
USING (bucket_id = 'nfe-pdfs');
