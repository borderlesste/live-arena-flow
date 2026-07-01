import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface DeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sourceName: string;
  isLive?: boolean;
}

export function DeleteSourceDialog({ isOpen, onClose, onConfirm, sourceName, isLive }: DeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar fuente de transmisión?</AlertDialogTitle>
          <AlertDialogDescription>
            Estás a punto de eliminar la fuente <strong>{sourceName}</strong>. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLive && (
          <Alert variant="destructive" className="my-2 border-destructive bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-destructive font-semibold">¡La transmisión está en vivo!</AlertTitle>
            <AlertDescription className="text-destructive/90 text-xs">
              Si eliminas esta fuente ahora mismo, interrumpirás la emisión en directo para todos los espectadores.
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Eliminar fuente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface RotateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sourceName: string;
  isLive?: boolean;
  relayMode?: boolean;
}

export function RotateStreamKeyDialog({ isOpen, onClose, onConfirm, sourceName, isLive, relayMode = false }: RotateDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{relayMode ? "¿Recrear destino Cloudflare?" : "¿Rotar clave de transmisión?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {relayMode
              ? <>Se creará un nuevo Live Input para <strong>{sourceName}</strong> y se retirará el anterior.</>
              : <>Se generará una nueva clave para <strong>{sourceName}</strong>. La clave anterior quedará invalidada inmediatamente.</>}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Alert className="my-2 border-warning/30 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning font-semibold">Reconfiguración requerida</AlertTitle>
          <AlertDescription className="text-muted-foreground text-xs">
            {relayMode
              ? "Deberás actualizar el canal Custom RTMP en Restream con el nuevo servidor y clave Cloudflare. OBS conserva sus credenciales Restream."
              : "Deberás copiar la nueva clave y configurarla en OBS. La emisión actual se detendrá hasta que actualices las credenciales."}
          </AlertDescription>
        </Alert>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-warning text-warning-foreground hover:bg-warning/90"
            onClick={onConfirm}
          >
            {relayMode ? "Recrear destino" : "Rotar credenciales"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
