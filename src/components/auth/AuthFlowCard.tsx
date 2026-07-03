import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AuthFlowCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthFlowCard({ title, description, children }: AuthFlowCardProps) {
  return (
    <section className="container mx-auto grid min-h-[70vh] place-items-center px-4 py-10 md:px-6">
      <Card className="surface-card w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto rounded-xl bg-white p-3"><BrandLogo variant="primary" size="md" priority /></div>
          <div>
            <CardTitle className="font-display text-2xl">{title}</CardTitle>
            <CardDescription className="mt-2">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          <Button asChild variant="ghost" className="w-full">
            <Link to="/profile"><ArrowLeft className="mr-2 h-4 w-4" />Volver al acceso</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
