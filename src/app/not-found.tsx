import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="space-y-6">
        <h1 className="text-9xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-2xl font-semibold">Страница не найдена</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Запрашиваемая страница не существует или была удалена.
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild>
            <Link href="/">На главную</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/catalog">Каталог курсов</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
