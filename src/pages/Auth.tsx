import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"),
});

const registerSchema = loginSchema.extend({
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().min(1, "กรุณากรอกนามสกุล"),
  studentId: z.string().optional(),
  groupId: z.string().optional(),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "รหัสผ่านไม่ตรงกัน",
  path: ["confirmPassword"],
});

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    studentId: "",
    groupId: "",
  });
  const [groups, setGroups] = useState<any[]>([]);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            hd: 'spumail.net,spu.ac.th,dotmini.in.th'
          }
        }
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถเข้าสู่ระบบด้วย Google ได้",
        description: error.message,
      });
    }
  };

  useEffect(() => {
    const fetchGroups = async () => {
      const { data } = await supabase.from("student_groups").select("*");
      if (data) setGroups(data);
    };
    fetchGroups();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      loginSchema.parse(loginData);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) throw error;

      toast({
        title: "เข้าสู่ระบบสำเร็จ",
        description: "ยินดีต้อนรับกลับ",
      });

      // Redirect based on role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .single();

      if (roleData?.role === "super_admin") {
        navigate("/super-admin");
      } else if (roleData?.role === "admin") {
        navigate("/admin");
      } else if (roleData?.role === "teacher") {
        navigate("/teacher");
      } else {
        navigate("/student");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถเข้าสู่ระบบได้",
        description: error.message || "กรุณาตรวจสอบอีเมลและรหัสผ่าน",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      registerSchema.parse(registerData);

      // Validate email domain - เฉพาะนักศึกษาเท่านั้น
      const isStudent = registerData.email.endsWith("@spumail.net");

      if (!isStudent) {
        throw new Error("สามารถลงทะเบียนได้เฉพาะนักศึกษา (@spumail.net) เท่านั้น อาจารย์และ Staff กรุณาติดต่อ Super Admin");
      }

      if (!registerData.studentId || !registerData.groupId) {
        throw new Error("กรุณากรอกรหัสนักศึกษาและเลือกกลุ่มเรียน");
      }

      const { data, error } = await supabase.auth.signUp({
        email: registerData.email,
        password: registerData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: registerData.firstName,
            last_name: registerData.lastName,
            student_id: registerData.studentId,
            group_id: registerData.groupId,
          },
        },
      });

      if (error) throw error;

      // Update profile with additional info
      if (data.user) {
        await supabase.from("profiles").update({
          student_id: registerData.studentId,
          group_id: registerData.groupId || null,
        }).eq("id", data.user.id);
      }

      toast({
        title: "ลงทะเบียนสำเร็จ",
        description: "คุณสามารถเข้าสู่ระบบได้เลย",
      });

      // Switch to login tab
      setLoginData({ email: registerData.email, password: "" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถลงทะเบียนได้",
        description: error.message || "กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="ระบบติดตามใบ Coaching"
      subtitle="มหาวิทยาลัยศรีปทุม"
    >
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="login">เข้าสู่ระบบ</TabsTrigger>
          <TabsTrigger value="register">ลงทะเบียน</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={handleLogin} className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 hover-scale animate-fade-in"
              onClick={handleGoogleLogin}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              เข้าสู่ระบบด้วย Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">หรือ</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-email">อีเมล</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="example@spumail.net"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">รหัสผ่าน</Label>
              <Input
                id="login-password"
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full hover-scale" disabled={isLoading}>
              {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={handleRegister} className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 hover-scale animate-fade-in"
              onClick={handleGoogleLogin}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              ลงทะเบียนด้วย Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">หรือ</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">ชื่อ</Label>
                <Input
                  id="firstName"
                  value={registerData.firstName}
                  onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">นามสกุล</Label>
                <Input
                  id="lastName"
                  value={registerData.lastName}
                  onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-email">อีเมล</Label>
              <Input
                id="register-email"
                type="email"
                placeholder="example@spumail.net"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                ระบบนี้เปิดให้ลงทะเบียนเฉพาะนักศึกษา (@spumail.net) เท่านั้น<br />
                อาจารย์และ Staff กรุณาติดต่อ Super Admin เพื่อสร้างบัญชี
              </p>
            </div>
            {registerData.email.endsWith("@spumail.net") && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="studentId">รหัสนักศึกษา</Label>
                  <Input
                    id="studentId"
                    value={registerData.studentId}
                    onChange={(e) => setRegisterData({ ...registerData, studentId: e.target.value })}
                    placeholder="รหัสนักศึกษา"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupId">กลุ่มเรียน</Label>
                  <select
                    id="groupId"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    value={registerData.groupId}
                    onChange={(e) => setRegisterData({ ...registerData, groupId: e.target.value })}
                    required
                  >
                    <option value="">เลือกกลุ่มเรียน</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} - {group.major} ชั้นปีที่ {group.year_level}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="register-password">รหัสผ่าน</Label>
              <Input
                id="register-password"
                type="password"
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">ยืนยันรหัสผ่าน</Label>
              <Input
                id="confirm-password"
                type="password"
                value={registerData.confirmPassword}
                onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full hover-scale" disabled={isLoading}>
              {isLoading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </AuthLayout>
  );
}