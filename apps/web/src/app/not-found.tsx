import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1025.png"
            alt="Pecharunt"
            width={64}
            height={64}
            className="pixelated mx-auto"
          />
          <CardTitle className="text-6xl font-bold font-display">404</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Pecharunt led you astray. This route doesn't exist.
          </p>
          <Link href="/">
            <Button>Return to Base</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
