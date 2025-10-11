import { Heart } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex flex-col items-center md:items-start gap-1">
            <p className="font-semibold">By SPU AI CLUB</p>
            <p>อาร์เซนอล (ผู้ทำระบบ)</p>
          </div>
          
          <div className="flex items-center gap-2">
            <span>Made with</span>
            <Heart className="h-4 w-4 text-red-500 fill-red-500" />
            <span>by SPU School of Entrepreneurship</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
