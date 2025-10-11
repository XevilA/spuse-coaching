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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardStats } from "@/components/DashboardStats";

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
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

    if (roleData?.role !== "admin" && roleData?.role !== "super_admin") {
      const redirectPath = roleData?.role === "teacher" ? "/teacher" : roleData?.role === "student" ? "/student" : "/auth";
      navigate(redirectPath);
      return;
    }

    setUser(session.user);
    fetchData();
  };

  const fetchData = async () => {
    try {
      const [profileRes, usersRes, sessionsRes, groupsRes, settingsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user?.id || "").single(),
        supabase.from("profiles").select(`
          *,
          user_roles (role)
        `),
        supabase.from("coaching_sessions").select("*, profiles!coaching_sessions_student_id_fkey(group_id)"),
        supabase.from("student_groups").select("*"),
        supabase.from("coaching_settings").select("*").eq("key", "min_sessions").single(),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (usersRes.data) setUsers(usersRes.data);
      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (groupsRes.data) setGroups(groupsRes.data);
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

  const studentCount = users.filter(u => u.user_roles?.[0]?.role === "student").length;
  const teacherCount = users.filter(u => u.user_roles?.[0]?.role === "teacher").length;

  const dashboardStats = {
    totalStudents: studentCount,
    totalTeachers: teacherCount,
    totalGroups: groups.length,
    totalSessions: sessions.length,
    approvedSessions: sessions.filter(s => s.status === "approved").length,
    pendingSessions: sessions.filter(s => s.status === "pending").length,
    rejectedSessions: sessions.filter(s => s.status === "rejected").length,
    sessionsByGroup: groups.map(g => ({
      name: g.name,
      count: sessions.filter(s => s.profiles?.group_id === g.id).length,
    })),
    sessionsByStatus: [
      { name: "อนุมัติแล้ว", value: sessions.filter(s => s.status === "approved").length },
      { name: "รอตรวจสอบ", value: sessions.filter(s => s.status === "pending").length },
      { name: "ไม่อนุมัติ", value: sessions.filter(s => s.status === "rejected").length },
    ],
  };

  return (
    <DashboardLayout role="admin" userName={`${profile?.first_name || ""} ${profile?.last_name || ""}`}>
      <div className="space-y-6">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="users">จัดการผู้ใช้</TabsTrigger>
            <TabsTrigger value="settings">ตั้งค่าระบบ</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardStats stats={dashboardStats} />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
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
                  <Button variant="outline" onClick={exportReport}>
                    <Download className="w-4 h-4 mr-2" />
                    ส่งออก CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>อีเมล</TableHead>
                      <TableHead>ชื่อ-นามสกุล</TableHead>
                      <TableHead>บทบาท</TableHead>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}