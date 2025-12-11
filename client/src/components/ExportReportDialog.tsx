import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileText, Download, Loader2, Printer } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ExportReportDialogProps {
  fieldId: number;
  fieldName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportReportDialog({
  fieldId,
  fieldName,
  open,
  onOpenChange,
}: ExportReportDialogProps) {
  const [includeNdvi, setIncludeNdvi] = useState(true);
  const [includeWeather, setIncludeWeather] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeCrops, setIncludeCrops] = useState(true);

  const generateReport = trpc.reports.generateFieldReport.useMutation({
    onSuccess: (data) => {
      // Open HTML in new window for printing/saving as PDF
      const newWindow = window.open("", "_blank");
      if (newWindow) {
        newWindow.document.write(data.htmlContent);
        newWindow.document.close();
        
        // Auto-trigger print dialog for PDF save
        setTimeout(() => {
          newWindow.print();
        }, 500);
      }
      toast.success("Relatório gerado! Use Ctrl+P para salvar como PDF.");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao gerar relatório: " + error.message);
    },
  });

  const handleExport = () => {
    generateReport.mutate({
      fieldId,
      includeNdvi,
      includeWeather,
      includeNotes,
      includeCrops,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Exportar Relatório
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-500 mb-4">
            Selecione o que incluir no relatório de <strong>{fieldName}</strong>:
          </p>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ndvi"
                checked={includeNdvi}
                onCheckedChange={(checked) => setIncludeNdvi(!!checked)}
              />
              <Label htmlFor="ndvi" className="cursor-pointer">
                Índice de Vegetação (NDVI)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="weather"
                checked={includeWeather}
                onCheckedChange={(checked) => setIncludeWeather(!!checked)}
              />
              <Label htmlFor="weather" className="cursor-pointer">
                Dados Climáticos
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notes"
                checked={includeNotes}
                onCheckedChange={(checked) => setIncludeNotes(!!checked)}
              />
              <Label htmlFor="notes" className="cursor-pointer">
                Notas de Campo
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="crops"
                checked={includeCrops}
                onCheckedChange={(checked) => setIncludeCrops(!!checked)}
              />
              <Label htmlFor="crops" className="cursor-pointer">
                Histórico de Cultivos
              </Label>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Dica:</strong> O relatório será aberto em uma nova janela. 
              Use <kbd className="bg-blue-100 px-1 rounded">Ctrl+P</kbd> (ou <kbd className="bg-blue-100 px-1 rounded">⌘+P</kbd> no Mac) 
              para salvar como PDF.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={generateReport.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {generateReport.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                Gerar Relatório
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
