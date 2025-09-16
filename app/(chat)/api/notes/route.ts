import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import {
  createNote,
  deleteNoteById,
  getNotesByUserId,
} from '@/lib/db/queries';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:notes').toResponse();
  }

  const notes = await getNotesByUserId({ userId: session.user.id });
  return Response.json(notes, { status: 200 });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:notes').toResponse();
  }

  const {
    title,
    content,
    tags,
  }: { title: string; content: string; tags?: string[] } = await request.json();

  if (!title || !content) {
    return new ChatSDKError(
      'bad_request:api',
      'Both title and content are required.',
    ).toResponse();
  }

  const note = await createNote({ userId: session.user.id, title, content, tags });
  return Response.json(note, { status: 200 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:notes').toResponse();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return new ChatSDKError('bad_request:api', 'Parameter id is required.').toResponse();
  }

  const deleted = await deleteNoteById({ id, userId: session.user.id });
  if (!deleted) {
    return new ChatSDKError('not_found:notes', 'Note not found.').toResponse();
  }

  return Response.json({ ok: true }, { status: 200 });
}
