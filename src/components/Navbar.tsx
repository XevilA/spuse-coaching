import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { GraduationCap, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-background/80 backdrop-blur-xl shadow-lg border-b border-border/50"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 group hover-scale"
          >
            <div
              className="p-2.5 rounded-xl transition-all duration-300 group-hover:shadow-elegant"
              style={{ background: "var(--gradient-primary)" }}
            >
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div className="text-left hidden md:block">
              <h1 className="text-lg font-bold text-foreground">
                ระบบติดตามใบ Coaching
              </h1>
              <p className="text-xs text-muted-foreground">
                คณะการสร้างเจ้าของธุรกิจ x SPU AI CLUB
              </p>
            </div>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {!user ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/auth")}
                  className="apple-button"
                >
                  เข้าสู่ระบบ
                </Button>
                <Button
                  onClick={() => navigate("/auth")}
                  className="apple-button-primary"
                >
                  เริ่มต้นใช้งาน
                </Button>
              </>
            ) : (
              <Button
                onClick={() => navigate("/student")}
                className="apple-button-primary"
              >
                ไปยังแดชบอร์ด
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-t border-border/50 animate-slide-down">
          <div className="container mx-auto px-6 py-6 space-y-4">
            {!user ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    navigate("/auth");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full apple-button"
                >
                  เข้าสู่ระบบ
                </Button>
                <Button
                  onClick={() => {
                    navigate("/auth");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full apple-button-primary"
                >
                  เริ่มต้นใช้งาน
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  navigate("/student");
                  setIsMobileMenuOpen(false);
                }}
                className="w-full apple-button-primary"
              >
                ไปยังแดชบอร์ด
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
