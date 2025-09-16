import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/app/(auth)/auth';

// Allowed MIME types for uploads (images, PDFs, Office docs, slides, text)
const ALLOWED_MIME_TYPES = [
  // images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // pdf
  'application/pdf',
  // word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  // powerpoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // text formats
  'text/plain',
  'text/markdown',
  'application/json',
  'text/x-log',
];

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 25 * 1024 * 1024, {
      message: 'File size should be less than 25MB',
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Do not pre-check request.body; calling formData() handles parsing safely

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(', ');

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const rawFile = formData.get('file') as File;
    const filename = rawFile.name;
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const byExt: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      md: 'text/markdown',
      json: 'application/json',
      log: 'text/x-log',
      rtf: 'text/plain',
    };
    const guessed = rawFile.type || byExt[ext] || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.includes(guessed)) {
      return NextResponse.json(
        {
          error:
            'Unsupported file type. Allowed: images, PDF, Word, Excel, PowerPoint, text.',
        },
        { status: 400 },
      );
    }
    const contentType = guessed;
    const fileBuffer = await rawFile.arrayBuffer();

    try {
      const data = await put(`${filename}`, fileBuffer, {
        access: 'public',
        contentType,
        addRandomSuffix: true,
      });

      return NextResponse.json(data);
    } catch (error) {
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
