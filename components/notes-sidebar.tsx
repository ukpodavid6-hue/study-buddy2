'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { PlusIcon } from '@/components/icons';
import { Trash2, Upload } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fetcher } from '@/lib/utils';
import type { Note } from '@/lib/db/schema';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export function NotesSidebar() {
  const { data, isLoading, mutate, error } = useSWR<Note[]>('/api/notes', fetcher);
  const [selected, setSelected] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [search, setSearch] = useState('');
  const [previewMode, setPreviewMode] = useState<'preview' | 'raw'>('preview');

  // File input ref and handlers (supports multiple files)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Array<{
    name: string;
    url?: string;
    contentType?: string;
    localUrl?: string;
  }>>([]);
  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;

    const isTextLike = (file: File) => {
      const t = file.type;
      if (!t) {
        // Fallback to extension-based check when type is empty
        const name = file.name.toLowerCase();
        return (
          name.endsWith('.txt') ||
          name.endsWith('.md') ||
          name.endsWith('.csv') ||
          name.endsWith('.json') ||
          name.endsWith('.log')
        );
      }
      return (
        t.startsWith('text/') ||
        t === 'application/json' ||
        t === 'text/csv' ||
        t === 'text/markdown' ||
        t === 'text/x-log'
      );
    };

    async function extractAndUploadDoc(file: File) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/files/extract', { method: 'POST', body: formData });
      if (!res.ok) {
        let msg = 'Extraction failed';
        try {
          const j = await res.json();
          msg = res.status === 401 ? 'Please sign in to upload files.' : j.error || msg;
        } catch {
          msg = res.status === 401 ? 'Please sign in to upload files.' : msg;
        }
        throw new Error(msg);
      }
      return (await res.json()) as { url?: string; filename: string; contentType?: string; text: string };
    }

    async function uploadOnlyDoc(file: File) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        let msg = 'Upload failed';
        try {
          const j = await res.json();
          msg = res.status === 401 ? 'Please sign in to upload files.' : j.error || msg;
        } catch {
          msg = res.status === 401 ? 'Please sign in to upload files.' : msg;
        }
        throw new Error(msg);
      }
      return (await res.json()) as { url: string; pathname: string; contentType?: string };
    }

    const textParts: string[] = [];
    const linkParts: string[] = [];
    const newPreviews: Array<{ name: string; url?: string; contentType?: string; localUrl?: string }> = [];

    try {
      await Promise.all(
        arr.map(async (f) => {
          if (isTextLike(f)) {
            const t = await f.text();
            const trimmed = t.trim();
            if (trimmed) textParts.push(trimmed);
            newPreviews.push({ name: f.name, contentType: f.type || 'text/plain' });
          } else {
            // Extract and upload non-text files, add link and preview
            try {
              const extracted = await extractAndUploadDoc(f);
              const label = f.name;
              if (extracted.text?.trim()) textParts.push(extracted.text.trim());
              if (extracted.url) linkParts.push(`[${label}](${extracted.url})`);
              newPreviews.push({ name: f.name, url: extracted.url, contentType: extracted.contentType });
            } catch (e: any) {
              // Fallback: upload only and add link
              try {
                const uploaded = await uploadOnlyDoc(f);
                linkParts.push(`[${f.name}](${uploaded.url})`);
                newPreviews.push({ name: f.name, url: uploaded.url, contentType: uploaded.contentType });
              } catch (err: any) {
                toast.error(`${f.name}: ${e?.message || 'Extraction failed'}`);
              }
            }
          }
        }),
      );
    } catch (e) {
      // no-op; individual errors are handled above
    }

    const mergedText = textParts.join('\n\n');
    const mergedLinks = linkParts.join('\n');
    const merged = [mergedText, mergedLinks].filter(Boolean).join('\n\n');

    if (merged) {
      setContent((prev) => (prev ? prev + '\n\n' + merged : merged));
    }

    if (!title) {
      setTitle(
        arr.length === 1
          ? arr[0].name.replace(/\.[^.]+$/, '')
          : `Merged notes (${arr.length} files)`,
      );
    }
    setSelectedFiles(arr.map((f) => f.name));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const notes = data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const tags = (n.tags ?? []).join(' ').toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        (n.content ?? '').toLowerCase().includes(q) ||
        tags.includes(q)
      );
    });
  }, [notes, search]);
  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selected) ?? null,
    [notes, selected],
  );

  useEffect(() => {
    if (!selected && notes.length > 0) {
      setSelected(notes[0].id);
    }
  }, [notes, selected]);

  const onCreate = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Please provide title and content');
      return;
    }
    const p = fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        content,
        tags: tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    toast.promise(p, {
      loading: 'Adding note...',
      success: async () => {
        setOpenAdd(false);
        setTitle('');
        setContent('');
        await mutate();
        return 'Note added';
      },
      error: 'Failed to add note',
    });
  };

  const onDelete = async () => {
    if (!deleteId) return;
    const p = fetch(`/api/notes?id=${deleteId}`, { method: 'DELETE' });
    toast.promise(p, {
      loading: 'Deleting note...',
      success: async () => {
        setShowDelete(false);
        await mutate();
        if (selected === deleteId) setSelected(null);
        return 'Note deleted';
      },
      error: 'Failed to delete note',
    });
  };

  function escapeHtml(html: string) {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderMarkdown(src: string) {
    // Simple markdown renderer: headings, bold, italic, code blocks, inline code, links, lists, paragraphs
    let s = src.replace(/\r\n?/g, '\n');
    // Escape first
    s = escapeHtml(s);
    // Code blocks ```
    s = s.replace(/```([\s\S]*?)```/g, (_m, p1) => `<pre><code>${p1}</code></pre>`);
    // Inline code `code`
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Headings
    s = s.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    s = s.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    s = s.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    s = s.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    s = s.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    s = s.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    // Bold **text** and Italic *text*
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
    // Unordered lists
    s = s.replace(/^(?:-\s+.+\n?)+/gm, (block) => {
      const items = block
        .trim()
        .split(/\n/)
        .map((line) => line.replace(/^-\s+/, ''))
        .map((li) => `<li>${li}</li>`) 
        .join('');
      return `<ul>${items}</ul>`;
    });
    // Paragraphs: wrap remaining lines separated by blank lines
    s = s
      .split(/\n{2,}/)
      .map((para) => {
        if (/^\s*<h\d|^\s*<ul|^\s*<pre|^\s*<p|^\s*<code/.test(para)) return para;
        const lines = para.replace(/\n/g, '<br/>');
        return `<p>${lines}</p>`;
      })
      .join('\n');
    return s;
  }

  return (
    <Sidebar side="right">
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-2">
          <div className="font-semibold text-lg">My Notes</div>
          <Button size="sm" variant="ghost" onClick={() => setOpenAdd(true)}>
            <PlusIcon />
            <span className="ml-1">Upload note</span>
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center gap-2 px-2 py-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="h-8"
            />
          </div>
          <SidebarGroupContent>
            {error && (
              <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                Login to manage your notes.
              </div>
            )}
            <SidebarMenu>
              {isLoading && (
                <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                  Loading notes...
                </div>
              )}
              {!isLoading && filtered.length === 0 && (
                <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                  No notes yet. Add one!
                </div>
              )}
              {filtered.map((n) => (
                <SidebarMenuItem key={n.id}>
                  <SidebarMenuButton
                    isActive={selected === n.id}
                    onClick={() => setSelected(n.id)}
                    className="items-center"
                  >
                    <span className="flex-1 truncate">{n.title}</span>
                    <div className="mr-2 hidden max-w-40 shrink-0 gap-1 overflow-hidden text-ellipsis md:flex">
                      {(n.tags ?? []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary" className="truncate">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(n.id);
                        setShowDelete(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>

            {selectedNote && (
              <div className="mt-3">
                <div className="mb-2 flex gap-2">
                  <Button
                    size="sm"
                    variant={previewMode === 'preview' ? 'default' : 'outline'}
                    onClick={() => setPreviewMode('preview')}
                  >
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant={previewMode === 'raw' ? 'default' : 'outline'}
                    onClick={() => setPreviewMode('raw')}
                  >
                    Raw
                  </Button>
                </div>
                {previewMode === 'raw' ? (
                  <div className="max-h-64 overflow-auto rounded-md border p-2 text-xs whitespace-pre-wrap">
                    {selectedNote.content}
                  </div>
                ) : (
                  <div
                    className="prose max-h-64 overflow-auto rounded-md border p-3 text-sm prose-zinc dark:prose-invert"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(selectedNote.content ?? ''),
                    }}
                  />
                )}
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Add/Upload Note */}
      <Sheet open={openAdd} onOpenChange={setOpenAdd}>
        <SheetContent side="right" className="w-[28rem] max-w-[90vw]">
          <SheetHeader>
            <SheetTitle>Upload note</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".txt,.md,.csv,.json,.log,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf"
                onChange={(e) => {
                  if (e.target.files) void handleFiles(e.target.files);
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="justify-center gap-2"
              >
                <Upload className="h-4 w-4" /> Upload from files
              </Button>
              <div className="text-muted-foreground text-xs">
                TXT, MD, CSV, JSON, LOG, PDF, DOCX, XLSX, PPTX • Multiple files supported
              </div>
              {selectedFiles.length > 0 && (
                <div className="max-h-20 overflow-auto rounded-md border p-2 text-xs">
                  <div className="mb-1 font-medium">Selected files</div>
                  <ul className="list-disc pl-4">
                    {selectedFiles.map((n) => (
                      <li key={n} className="truncate">{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <label className="text-sm">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
            <label className="text-sm">Preview</label>
            <div className="max-h-64 overflow-auto rounded-md border p-2">
              {previews.length === 0 && (
                <div className="text-muted-foreground text-xs">No preview yet. Select files above to see a preview.</div>
              )}
              <div className="grid grid-cols-1 gap-3">
                {previews.map((p) => {
                  const ct = (p.contentType || '').toLowerCase();
                  const isImage = ct.startsWith('image/');
                  const isPdf = ct === 'application/pdf';
                  const isPpt = ct.includes('presentation') || ct.includes('powerpoint');
                  const isWord = ct.includes('wordprocessingml') || ct.includes('msword');
                  const isExcel = ct.includes('spreadsheetml') || ct.includes('ms-excel') || ct === 'text/csv';
                  const url = p.url || p.localUrl;
                  return (
                    <div key={p.name} className="rounded border p-2">
                      <div className="mb-2 text-xs font-medium truncate">{p.name}</div>
                      {url ? (
                        isImage ? (
                          <img src={url} alt={p.name} className="h-36 w-full object-contain bg-muted" />
                        ) : isPdf ? (
                          <object data={`${url}#view=FitH`} type="application/pdf" className="h-36 w-full">
                            <a href={url} target="_blank" rel="noreferrer">Open PDF</a>
                          </object>
                        ) : isWord || isExcel || isPpt ? (
                          <iframe
                            className="h-36 w-full bg-muted"
                            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
                          />
                        ) : (
                          <a className="text-xs underline" href={url} target="_blank" rel="noreferrer">Open file</a>
                        )
                      ) : (
                        <div className="text-muted-foreground text-xs">No preview available.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <label className="text-sm">Tags (comma-separated)</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. math, lecture 3, exam"
            />
          </div>
          <SheetFooter className="mt-4">
            <Button onClick={onCreate}>Save Note</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Yes, delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
