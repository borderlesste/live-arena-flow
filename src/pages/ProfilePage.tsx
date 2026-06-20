import { Link } from "react-router-dom";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Button } from "@/components/ui/button";
import { LogIn, User } from "lucide-react";
import { EmptyState } from "@/components/feedback/States";
import { toast } from "sonner";

const ProfilePage = () => {
  useDocumentMeta({ title: "Perfil", description: "Inicia sesión para personalizar tu experiencia." });
  return (
    <section className="container mx-auto px-4 py-10 md:px-6">
      <EmptyState
        icon={<User className="h-10 w-10" />}
        title="Inicia sesión para ver tu perfil"
        description="Con tu cuenta podrás guardar partidos, equipos y competiciones favoritas. La autenticación requiere backend."
        action={
          <div className="flex gap-2">
            <Button onClick={() => toast.info("Login demo")} className="bg-gradient-primary text-primary-foreground"><LogIn className="mr-1.5 h-4 w-4" />Iniciar sesión</Button>
            <Button asChild variant="outline"><Link to="/">Volver al inicio</Link></Button>
          </div>
        }
      />
    </section>
  );
};

export default ProfilePage;
