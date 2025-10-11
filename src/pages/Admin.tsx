import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Users, Download, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [minSessions, setMinSessions] = useState("10");
  const [isLoading, setIsLoading] = useState(true);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "student",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (roleData?.role !== "admin") {
      navigate(`/${roleData?.role || "auth"}`);
      return;
    }

    setUser(session.user);
    fetchData();
  };

  const fetchData = async () => {
    try {
      const [profileRes, usersRes, settingsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user?.id || "").single(),
        supabase.from("profiles").select(`
          *,
          user_roles (role)
        `),
        supabase.from("coaching_settings").select("*").eq("key", "min_sessions").single(),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (usersRes.data) setUsers(usersRes.data);
      if (settingsRes.data) setMinSessions(settingsRes.data.value);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async () => {
    try {
      const { error } = await supabase
        .from("coaching_settings")
        .update({ value: minSessions })
        .eq("key", "min_sessions");

      if (error) throw error;

      toast({
        title: "บันทึกสำเร็จ",
        description: "อัปเดตการตั้งค่าแล้ว",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const exportReport = () => {
    const csv = [
      ["Email", "ชื่อ", "นามสกุล", "บทบาท"],
      ...users.map(u => [
        u.email,
        u.first_name,
        u.last_name,
        u.user_roles?.[0]?.role || "-"
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `coaching-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast({
      title: "ส่งออกสำเร็จ",
      description: "ดาวน์โหลดรายงานแล้ว",
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">กำลังโหลด...</div>;
  }

  return (
    <DashboardLayout role="admin" userName={`${profile?.first_name || ""} ${profile?.last_name || ""}`}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                ตั้งค่าระบบ
              </CardTitle>
              <CardDescription>กำหนดจำนวนครั้งขั้นต่ำ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="minSessions">จำนวนครั้งขั้นต่ำ</Label>
                <Input
                  id="minSessions"
                  type="number"
                  value={minSessions}
                  onChange={(e) => setMinSessions(e.target.value)}
                />
              </div>
              <Button onClick={updateSettings} className="w-full">
                บันทึกการตั้งค่า
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                ส่งออกรายงาน
              </CardTitle>
              <CardDescription>ดาวน์โหลดข้อมูลทั้งหมด</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={exportReport} variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                ส่งออกรายงาน CSV
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  จัดการผู้ใช้งาน
                </CardTitle>
                <CardDescription>เพิ่ม แก้ไข หรือลบผู้ใช้งาน</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="w-4 h-4 mr-2" />
                    เพิ่มผู้ใช้
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>ชื่อ</Label>
                        <Input
                          value={newUser.firstName}
                          onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>นามสกุล</Label>
                        <Input
                          value={newUser.lastName}
                          onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>อีเมล</Label>
                      <Input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>รหัสผ่าน</Label>
                      <Input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>บทบาท</Label>
                      <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">นักศึกษา</SelectItem>
                          <SelectItem value="teacher">อาจารย์</SelectItem>
                          <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full">เพิ่มผู้ใช้</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>อีเมล</TableHead>
                  <TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead>บทบาท</TableHead>
                  <TableHead className="text-right">ดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>{`${u.first_name} ${u.last_name}`}</TableCell>
                    <TableCell>
                      {u.user_roles?.[0]?.role === "admin" ? "ผู้ดูแลระบบ" : 
                       u.user_roles?.[0]?.role === "teacher" ? "อาจารย์" : "นักศึกษา"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}