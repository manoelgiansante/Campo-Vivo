import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Folder, 
  ChevronDown, 
  FileText,
  Plus
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

// Mock notes
const mockNotes: any[] = [];

export default function NotesOneSoil() {
  const [, setLocation] = useLocation();
  const [selectedFolder, setSelectedFolder] = useState("All fields");

  const notes = mockNotes;

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Header */}
      <div className="bg-gray-100 sticky top-0 z-10 px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <Folder className="h-4 w-4" />
              <span>{selectedFolder}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setSelectedFolder("All fields")}>
              All fields
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedFolder("pasto 1")}>
              pasto 1
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="px-4 mt-4">
        {notes.length > 0 ? (
          <div className="space-y-3">
            {notes.map((note, index) => (
              <NoteCard key={index} note={note} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-600 mb-6 max-w-xs mx-auto">
              Add noted when you conduct field scouting or when you want to mark an important place on the map.
            </p>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full px-6"
              onClick={() => {}}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add note
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Note Card Component
function NoteCard({ note }: { note: any }) {
  return (
    <div className="bg-white rounded-2xl p-4">
      <div className="flex items-start gap-3">
        {note.image && (
          <div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden flex-shrink-0">
            <img src={note.image} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{note.title}</h3>
          <p className="text-sm text-gray-500 line-clamp-2">{note.description}</p>
          <p className="text-xs text-gray-400 mt-2">{note.date}</p>
        </div>
      </div>
    </div>
  );
}
