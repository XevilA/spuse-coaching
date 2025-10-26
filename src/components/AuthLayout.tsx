import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export const AuthLayout = ({ children, title, subtitle }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: "var(--gradient-subtle)" }}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 animate-float" 
             style={{ background: "var(--gradient-primary)", filter: "blur(80px)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-20 animate-float-delayed" 
             style={{ background: "var(--gradient-primary)", filter: "blur(80px)", animationDelay: "2s" }} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-block p-3 rounded-2xl mb-4 animate-bounce-subtle" 
               style={{ 
                 background: "var(--gradient-primary)",
                 boxShadow: "0 20px 40px -12px hsl(var(--primary) / 0.3)"
               }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2 gradient-text animate-slide-down">{title}</h1>
          <p className="text-muted-foreground animate-slide-down" style={{ animationDelay: "0.1s" }}>{subtitle}</p>
        </div>
        
        <div className="bg-card/80 backdrop-blur-xl rounded-2xl shadow-elegant p-8 border border-border/50 animate-slide-up"
             style={{ animationDelay: "0.2s" }}>
          {children}
        </div>
      </div>
    </div>
  );
};