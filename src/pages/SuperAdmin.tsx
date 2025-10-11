import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, FileCheck, Settings, UserPlus, Trash2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppointmentCalendar } from "@/components/AppointmentCalendar";
import { Textarea } from "@/components/ui/textarea";
import { DashboardStats } from "@/components/DashboardStats";
import { Badge } from "@/components/ui/badge";

export default function SuperAdmin() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [lineChannels, setLineChannels] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [minSessions, setMinSessions] = useState("10");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isAddLineChannelOpen, setIsAddLineChannelOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "student",
  });
  const [newGroup, setNewGroup] = useState({
    name: "",
    major: "",
    yearLevel: "",
  });
  const [newLineChannel, setNewLineChannel] = useState({
    name: "",
    description: "",
    channelAccessToken: "",
    channelSecret: "",
    groupId: "",
    notificationType: "",
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

    if (roleData?.role !== "super_admin") {
      navigate(`/${roleData?.role || "auth"}`);
      return;
    }

    setUser(session.user);
    fetchData(session.user.id);
  };

  const fetchData = async (userId: string) => {
    try {
      const [profileRes, usersRes, groupsRes, sessionsRes, settingsRes, lineChannelsRes, assignmentsRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("profiles").select(`*, user_roles (role)`),
        supabase.from("student_groups").select("*"),
        supabase.from("coaching_sessions").select("*, profiles!coaching_sessions_student_id_fkey(group_id)"),
        supabase.from("coaching_settings").select("*").eq("key", "min_sessions").single(),
        supabase.from("line_notifications").select("*"),
        supabase.from("teacher_assignments").select("*, profiles!teacher_assignments_teacher_id_fkey(first_name, last_name), student_groups(name)"),
        supabase.from("group_members").select("*, profiles!group_members_student_id_fkey(first_name, last_name, student_id)"),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (usersRes.data) setUsers(usersRes.data);
      if (groupsRes.data) setGroups(groupsRes.data);
      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (settingsRes.data) setMinSessions(settingsRes.data.value);
      if (lineChannelsRes.data) setLineChannels(lineChannelsRes.data);
      if (assignmentsRes.data) setTeacherAssignments(assignmentsRes.data);
      if (membersRes.data) setGroupMembers(membersRes.data);
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

  const handleAddUser = async () => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            first_name: newUser.firstName,
            last_name: newUser.lastName,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: newUser.role as "student" | "teacher" | "admin" | "super_admin" })
          .eq("user_id", data.user.id);

        if (roleError) throw roleError;
      }

      toast({
        title: "เพิ่มผู้ใช้สำเร็จ",
        description: `เพิ่ม ${newUser.email} แล้ว`,
      });

      setIsAddUserOpen(false);
      setNewUser({ email: "", password: "", firstName: "", lastName: "", role: "student" });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถเพิ่มผู้ใช้ได้",
        description: error.message,
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("ต้องการลบผู้ใช้นี้หรือไม่?")) return;

    try {
      // Delete user_roles first
      await supabase.from("user_roles").delete().eq("user_id", userId);
      
      // Delete profile
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;

      toast({
        title: "ลบผู้ใช้สำเร็จ",
      });

      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถลบผู้ใช้ได้",
        description: error.message,
      });
    }
  };

  const exportReport = () => {
    const csv = [
      ["Email", "ชื่อ", "นามสกุล", "บทบาท", "รหัสนักศึกษา", "รหัสพนักงาน"],
      ...users.map(u => [
        u.email,
        u.first_name,
        u.last_name,
        u.user_roles?.[0]?.role || "-",
        u.student_id || "-",
        u.employee_id || "-",
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `super-admin-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast({
      title: "ส่งออกสำเร็จ",
      description: "ดาวน์โหลดรายงานแล้ว",
    });
  };

  const handleAddGroup = async () => {
    try {
      const { error } = await supabase
        .from("student_groups")
        .insert({
          name: newGroup.name,
          major: newGroup.major,
          year_level: newGroup.yearLevel,
        });

      if (error) throw error;

      toast({
        title: "เพิ่มกลุ่มสำเร็จ",
        description: `เพิ่มกลุ่ม ${newGroup.name} แล้ว`,
      });

      setIsAddGroupOpen(false);
      setNewGroup({ name: "", major: "", yearLevel: "" });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถเพิ่มกลุ่มได้",
        description: error.message,
      });
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("ต้องการลบกลุ่มนี้หรือไม่?")) return;

    try {
      const { error } = await supabase.from("student_groups").delete().eq("id", groupId);
      if (error) throw error;

      toast({
        title: "ลบกลุ่มสำเร็จ",
      });

      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถลบกลุ่มได้",
        description: error.message,
      });
    }
  };

  const handleAddLineChannel = async () => {
    try {
      const { error } = await supabase
        .from("line_notifications")
        .insert({
          name: newLineChannel.name,
          description: newLineChannel.description,
          channel_access_token: newLineChannel.channelAccessToken,
          channel_secret: newLineChannel.channelSecret,
          group_id: newLineChannel.groupId || null,
          notification_type: newLineChannel.notificationType || null,
          enabled: true,
        });

      if (error) throw error;

      toast({
        title: "เพิ่ม LINE Channel สำเร็จ",
        description: `เพิ่ม ${newLineChannel.name} แล้ว`,
      });

      setIsAddLineChannelOpen(false);
      setNewLineChannel({
        name: "",
        description: "",
        channelAccessToken: "",
        channelSecret: "",
        groupId: "",
        notificationType: "",
      });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถเพิ่ม LINE Channel ได้",
        description: error.message,
      });
    }
  };

  const handleDeleteLineChannel = async (channelId: string) => {
    if (!confirm("ต้องการลบ LINE Channel นี้หรือไม่?")) return;

    try {
      const { error } = await supabase.from("line_notifications").delete().eq("id", channelId);
      if (error) throw error;

      toast({
        title: "ลบ LINE Channel สำเร็จ",
      });

      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถลบ LINE Channel ได้",
        description: error.message,
      });
    }
  };

  const handleToggleLineChannel = async (channelId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("line_notifications")
        .update({ enabled })
        .eq("id", channelId);

      if (error) throw error;

      toast({
        title: enabled ? "เปิดใช้งานแล้ว" : "ปิดใช้งานแล้ว",
      });

      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const handleAssignTeacher = async (groupId: string, teacherId: string) => {
    try {
      const { error } = await supabase
        .from("teacher_assignments")
        .insert({ group_id: groupId, teacher_id: teacherId });

      if (error) throw error;

      toast({
        title: "มอบหมายอาจารย์สำเร็จ",
      });

      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const handleRemoveTeacherAssignment = async (assignmentId: string) => {
    if (!confirm("ต้องการยกเลิกการมอบหมายนี้หรือไม่?")) return;

    try {
      const { error } = await supabase
        .from("teacher_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      toast({
        title: "ยกเลิกการมอบหมายสำเร็จ",
      });

      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const handleAddStudentToGroup = async (groupId: string, studentId: string) => {
    try {
      const { error } = await supabase
        .from("group_members")
        .insert({ group_id: groupId, student_id: studentId });

      if (error) throw error;

      // Update student's group_id in profiles
      await supabase
        .from("profiles")
        .update({ group_id: groupId })
        .eq("id", studentId);

      toast({
        title: "เพิ่มนักศึกษาสำเร็จ",
      });

      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const handleRemoveStudentFromGroup = async (memberId: string, studentId: string) => {
    if (!confirm("ต้องการลบนักศึกษาออกจากกลุ่มนี้หรือไม่?")) return;

    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      // Clear student's group_id in profiles
      await supabase
        .from("profiles")
        .update({ group_id: null })
        .eq("id", studentId);

      toast({
        title: "ลบนักศึกษาสำเร็จ",
      });

      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">กำลังโหลด...</div>;
  }

  const studentCount = users.filter(u => u.user_roles?.[0]?.role === "student").length;
  const teacherCount = users.filter(u => u.user_roles?.[0]?.role === "teacher").length;
  const adminCount = users.filter(u => u.user_roles?.[0]?.role === "admin").length;
  
  const students = users.filter(u => u.user_roles?.[0]?.role === "student");
  const teachers = users.filter(u => u.user_roles?.[0]?.role === "teacher");

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
    <DashboardLayout role="super_admin" userName={`${profile?.first_name || ""} ${profile?.last_name || ""}`}>
      <div className="space-y-6">
        <AppointmentCalendar role="super_admin" userId={user?.id || ""} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">นักศึกษา</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{studentCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">อาจารย์</CardTitle>
              <Shield className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{teacherCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ผู้ดูแลระบบ</CardTitle>
              <Shield className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{adminCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ใบ Coaching</CardTitle>
              <FileCheck className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{sessions.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="users">จัดการผู้ใช้</TabsTrigger>
            <TabsTrigger value="groups">จัดการกลุ่ม</TabsTrigger>
            <TabsTrigger value="line">LINE Notifications</TabsTrigger>
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
                      จัดการผู้ใช้งานทั้งหมด
                    </CardTitle>
                    <CardDescription>เพิ่ม แก้ไข หรือลบผู้ใช้งานในระบบ</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={exportReport}>
                      <Download className="w-4 h-4 mr-2" />
                      ส่งออก CSV
                    </Button>
                    <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
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
                                <SelectItem value="super_admin">Super Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button className="w-full" onClick={handleAddUser}>เพิ่มผู้ใช้</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>อีเมล</TableHead>
                      <TableHead>ชื่อ-นามสกุล</TableHead>
                      <TableHead>บทบาท</TableHead>
                      <TableHead>รหัส</TableHead>
                      <TableHead className="text-right">ดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>{`${u.first_name} ${u.last_name}`}</TableCell>
                        <TableCell>
                          {u.user_roles?.[0]?.role === "super_admin" ? "Super Admin" :
                           u.user_roles?.[0]?.role === "admin" ? "ผู้ดูแลระบบ" : 
                           u.user_roles?.[0]?.role === "teacher" ? "อาจารย์" : "นักศึกษา"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.student_id || u.employee_id || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={u.id === user?.id}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>จัดการกลุ่มนักศึกษา</CardTitle>
                    <CardDescription>เพิ่ม แก้ไข หรือลบกลุ่มเรียน</CardDescription>
                  </div>
                  <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="w-4 h-4 mr-2" />
                        เพิ่มกลุ่ม
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>เพิ่มกลุ่มใหม่</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>ชื่อกลุ่ม</Label>
                          <Input
                            value={newGroup.name}
                            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>สาขา</Label>
                          <Input
                            value={newGroup.major}
                            onChange={(e) => setNewGroup({ ...newGroup, major: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>ชั้นปี</Label>
                          <Input
                            value={newGroup.yearLevel}
                            onChange={(e) => setNewGroup({ ...newGroup, yearLevel: e.target.value })}
                          />
                        </div>
                        <Button className="w-full" onClick={handleAddGroup}>เพิ่มกลุ่ม</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อกลุ่ม</TableHead>
                      <TableHead>สาขา</TableHead>
                      <TableHead>ชั้นปี</TableHead>
                      <TableHead className="text-right">ดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((group: any) => (
                      <React.Fragment key={group.id}>
                        <TableRow>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>{group.major}</TableCell>
                         <TableCell>{group.year_level}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedGroup(selectedGroup === group.id ? null : group.id)}
                            className="mr-2"
                          >
                            {selectedGroup === group.id ? "ซ่อน" : "จัดการ"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteGroup(group.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {selectedGroup === group.id ? (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <div className="p-4 space-y-4 bg-muted/50 rounded-lg">
                              <div className="space-y-2">
                                <h4 className="font-semibold">อาจารย์ผู้รับผิดชอบ</h4>
                                <div className="flex gap-2 flex-wrap">
                                  {teacherAssignments
                                    .filter(a => a.group_id === group.id)
                                    .map(assignment => (
                                      <Badge key={assignment.id} variant="secondary" className="gap-2">
                                        {assignment.profiles?.first_name} {assignment.profiles?.last_name}
                                        <button
                                          onClick={() => handleRemoveTeacherAssignment(assignment.id)}
                                          className="ml-1 hover:text-destructive"
                                        >
                                          ✕
                                        </button>
                                      </Badge>
                                    ))}
                                </div>
                                <Select onValueChange={(teacherId) => handleAssignTeacher(group.id, teacherId)}>
                                  <SelectTrigger className="w-[300px]">
                                    <SelectValue placeholder="เพิ่มอาจารย์" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {teachers.map(t => (
                                      <SelectItem key={t.id} value={t.id}>
                                        {t.first_name} {t.last_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <h4 className="font-semibold">นักศึกษาในกลุ่ม</h4>
                                <div className="flex gap-2 flex-wrap">
                                  {groupMembers
                                    .filter(m => m.group_id === group.id)
                                    .map(member => (
                                      <Badge key={member.id} variant="outline" className="gap-2">
                                        {member.profiles?.first_name} {member.profiles?.last_name}
                                        ({member.profiles?.student_id})
                                        <button
                                          onClick={() => handleRemoveStudentFromGroup(member.id, member.student_id)}
                                          className="ml-1 hover:text-destructive"
                                        >
                                          ✕
                                        </button>
                                      </Badge>
                                    ))}
                                </div>
                                <Select onValueChange={(studentId) => handleAddStudentToGroup(group.id, studentId)}>
                                  <SelectTrigger className="w-[300px]">
                                    <SelectValue placeholder="เพิ่มนักศึกษา" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {students
                                      .filter(s => !groupMembers.some(m => m.student_id === s.id && m.group_id === group.id))
                                      .map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                          {s.first_name} {s.last_name} ({s.student_id})
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="line" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>จัดการ LINE Notifications</CardTitle>
                    <CardDescription>เพิ่ม แก้ไข หรือลบ LINE Channel (รองรับได้ถึง 5-6 channels)</CardDescription>
                  </div>
                  <Dialog open={isAddLineChannelOpen} onOpenChange={setIsAddLineChannelOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="w-4 h-4 mr-2" />
                        เพิ่ม Channel
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>เพิ่ม LINE Channel ใหม่</DialogTitle>
                        <DialogDescription>
                          กรอกข้อมูล Channel Access Token และ Channel Secret จาก LINE Developers Console
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>ชื่อ Channel</Label>
                          <Input
                            placeholder="เช่น LINE Group 1"
                            value={newLineChannel.name}
                            onChange={(e) => setNewLineChannel({ ...newLineChannel, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>คำอธิบาย</Label>
                          <Textarea
                            placeholder="คำอธิบายเกี่ยวกับ channel นี้"
                            value={newLineChannel.description}
                            onChange={(e) => setNewLineChannel({ ...newLineChannel, description: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Channel Access Token</Label>
                          <Textarea
                            placeholder="Channel Access Token จาก LINE Developers"
                            value={newLineChannel.channelAccessToken}
                            onChange={(e) => setNewLineChannel({ ...newLineChannel, channelAccessToken: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Channel Secret</Label>
                          <Input
                            placeholder="Channel Secret จาก LINE Developers"
                            value={newLineChannel.channelSecret}
                            onChange={(e) => setNewLineChannel({ ...newLineChannel, channelSecret: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Group ID (ถ้ามี)</Label>
                          <Input
                            placeholder="Group ID สำหรับส่งข้อความ (optional)"
                            value={newLineChannel.groupId}
                            onChange={(e) => setNewLineChannel({ ...newLineChannel, groupId: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>ประเภทการแจ้งเตือน</Label>
                          <Select 
                            value={newLineChannel.notificationType} 
                            onValueChange={(value) => setNewLineChannel({ ...newLineChannel, notificationType: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="เลือกประเภท" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="group">Group Message</SelectItem>
                              <SelectItem value="broadcast">Broadcast Message</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button className="w-full" onClick={handleAddLineChannel}>เพิ่ม Channel</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อ</TableHead>
                      <TableHead>คำอธิบาย</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">ดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineChannels.map((channel: any) => (
                      <TableRow key={channel.id}>
                        <TableCell className="font-medium">{channel.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {channel.description || "-"}
                        </TableCell>
                        <TableCell>
                          {channel.notification_type === "group" ? "Group" : 
                           channel.notification_type === "broadcast" ? "Broadcast" : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleLineChannel(channel.id, !channel.enabled)}
                          >
                            {channel.enabled ? "✅ เปิด" : "❌ ปิด"}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLineChannel(channel.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  ตั้งค่าระบบ
                </CardTitle>
                <CardDescription>กำหนดค่าต่างๆ ของระบบ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="minSessions">จำนวนครั้งขั้นต่ำสำหรับ Coaching</Label>
                  <Input
                    id="minSessions"
                    type="number"
                    value={minSessions}
                    onChange={(e) => setMinSessions(e.target.value)}
                  />
                </div>
                <Button onClick={updateSettings}>
                  บันทึกการตั้งค่า
                </Button>
              </CardContent>
            </Card>

          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
