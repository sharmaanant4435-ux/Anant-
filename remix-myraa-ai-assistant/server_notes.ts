import fs from "fs/promises";
import path from "path";

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

const NOTES_FILE = path.join(process.cwd(), "notes.json");

export async function loadNotes(): Promise<NoteItem[]> {
  try {
    const data = await fs.readFile(NOTES_FILE, "utf-8");
    return JSON.parse(data) as NoteItem[];
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return [];
    }
    console.error("[Notes] Error reading notes file:", err);
    return [];
  }
}

export async function saveNotes(notes: NoteItem[]): Promise<void> {
  try {
    await fs.writeFile(NOTES_FILE, JSON.stringify(notes, null, 2), "utf-8");
  } catch (err) {
    console.error("[Notes] Error saving notes:", err);
  }
}
