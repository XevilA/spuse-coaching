import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Shield,
  Users,
  FileCheck,
  Settings,
  UserPlus,
  Trash2,
  Download,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { exportToPDF, exportToExcel, exportToCSV } from "@/utils/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppointmentCalendar } from "@/components/AppointmentCalendar";
import { Textarea } from "@/components/ui/textarea";
import { DashboardStats } from "@/components/DashboardStats";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: string; id: string; name: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<any>({});

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

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("admin-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchData(user.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "coaching_sessions" }, () => fetchData(user.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "teacher_assignments" }, () => fetchData(user.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => fetchData(user.id))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).single();

    if (roleData?.role !== "super_admin") {
      navigate(`/${roleData?.role || "auth"}`);
      return;
    }

    setUser(session.user);
    fetchData(session.user.id);
  };

  const fetchData = async (userId: string) => {
    try {
      const [profileRes, usersRes, groupsRes, sessionsRes, settingsRes, lineChannelsRes, assignmentsRes, membersRes] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).single(),
          supabase.from("profiles").select(`*, user_roles (role)`),
          supabase.from("student_groups").select("*"),
          supabase.from("coaching_sessions").select("*, profiles!coaching_sessions_student_id_fkey(group_id)"),
          supabase.from("coaching_settings").select("*").eq("key", "min_sessions").single(),
          supabase.from("line_notifications").select("*"),
          supabase
            .from("teacher_assignments")
            .select("*, profiles!teacher_assignments_teacher_id_fkey(first_name, last_name), student_groups(name)"),
          supabase
            .from("group_members")
            .select("*, profiles!group_members_student_id_fkey(first_name, last_name, student_id)"),
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

  const validateUserForm = () => {
    const errors: any = {};
    if (!newUser.email) errors.email = "กรุณากรอกอีเมล";
    if (!newUser.email.includes("@")) errors.email = "รูปแบบอีเมลไม่ถูกต้อง";
    if (!newUser.password) errors.password = "กรุณากรอกรหัสผ่าน";
    if (newUser.password.length < 6) errors.password = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
    if (!newUser.firstName) errors.firstName = "กรุณากรอกชื่อ";
    if (!newUser.lastName) errors.lastName = "กรุณากรอกนามสกุล";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
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
    if (!validateUserForm()) return;

    setIsSubmitting(true);
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
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: newUser.role as "student" | "teacher" | "admin" | "super_admin" })
          .eq("user_id", data.user.id);

        if (roleError) {
          console.error("Role update error:", roleError);
        }

        const profileUpdates: any = {};
        if (newUser.role === "student" && newUser.email.includes("@spumail.net")) {
          profileUpdates.student_id = newUser.email.split("@")[0];
        } else if (newUser.role === "teacher" && newUser.email.includes("@spu.ac.th")) {
          profileUpdates.employee_id = newUser.email.split("@")[0];
        }

        if (Object.keys(profileUpdates).length > 0) {
          await supabase.from("profiles").update(profileUpdates).eq("id", data.user.id);
        }
      }

      toast({
        title: "เพิ่มผู้ใช้สำเร็จ",
        description: `เพิ่ม ${newUser.email} แล้ว`,
      });

      setIsAddUserOpen(false);
      setNewUser({ email: "", password: "", firstName: "", lastName: "", role: "student" });
      setFormErrors({});
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถเพิ่มผู้ใช้ได้",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === "user") {
        await supabase.from("user_roles").delete().eq("user_id", itemToDelete.id);
        const { error } = await supabase.from("profiles").delete().eq("id", itemToDelete.id);
        if (error) throw error;
        toast({ title: "ลบผู้ใช้สำเร็จ" });
      } else if (itemToDelete.type === "group") {
        const { error } = await supabase.from("student_groups").delete().eq("id", itemToDelete.id);
        if (error) throw error;
        toast({ title: "ลบกลุ่มสำเร็จ" });
      } else if (itemToDelete.type === "line_channel") {
        const { error } = await supabase.from("line_notifications").delete().eq("id", itemToDelete.id);
        if (error) throw error;
        toast({ title: "ลบ LINE Channel สำเร็จ" });
      }

      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const handleDeleteUser = (userId: string, email: string) => {
    setItemToDelete({ type: "user", id: userId, name: email });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    setItemToDelete({ type: "group", id: groupId, name: groupName });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteLineChannel = (channelId: string, channelName: string) => {
    setItemToDelete({ type: "line_channel", id: channelId, name: channelName });
    setDeleteConfirmOpen(true);
  };

  const exportReport = (format: "pdf" | "excel" | "csv") => {
    const exportData = users.map((u) => ({
      Email: u.email,
      ชื่อ: u.first_name,
      นามสกุล: u.last_name,
      บทบาท:
        u.user_roles?.[0]?.role === "super_admin"
          ? "Super Admin"
          : u.user_roles?.[0]?.role === "admin"
            ? "ผู้ดูแลระบบ"
            : u.user_roles?.[0]?.role === "teacher"
              ? "อาจารย์"
              : "นักศึกษา",
      รหัสนักศึกษา: u.student_id || "-",
      รหัสพนักงาน: u.employee_id || "-",
    }));

    if (format === "pdf") {
      exportToPDF(
        exportData,
        "รายงานผู้ใช้งานระบบ",
        ["Email", "ชื่อ", "นามสกุล", "บทบาท", "รหัสนักศึกษา", "รหัสพนักงาน"],
        ["Email", "ชื่อ", "นามสกุล", "บทบาท", "รหัสนักศึกษา", "รหัสพนักงาน"],
      );
    } else if (format === "excel") {
      exportToExcel(exportData, "รายงานผู้ใช้งานระบบ", "ผู้ใช้");
    } else {
      exportToCSV(exportData, "รายงานผู้ใช้งานระบบ");
    }

    toast({
      title: "ส่งออกสำเร็จ",
      description: `ดาวน์โหลดรายงานแล้ว (${format.toUpperCase()})`,
    });
  };

  const handleAddGroup = async () => {
    if (!newGroup.name || !newGroup.major || !newGroup.yearLevel) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกข้อมูลให้ครบถ้วน",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("student_groups").insert({
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLineChannel = async () => {
    if (!newLineChannel.name || !newLineChannel.channelAccessToken || !newLineChannel.channelSecret) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("line_notifications").insert({
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLineChannel = async (channelId: string, enabled: boolean) => {
    try {
      const { error } = await supabase.from("line_notifications").update({ enabled }).eq("id", channelId);

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
      const { error } = await supabase.from("teacher_assignments").insert({ group_id: groupId, teacher_id: teacherId });

      if (error) throw error;

      toast({ title: "มอบหมายอาจารย์สำเร็จ" });
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
    try {
      const { error } = await supabase.from("teacher_assignments").delete().eq("id", assignmentId);

      if (error) throw error;

      toast({ title: "ยกเลิกการมอบหมายสำเร็จ" });
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
      const { error } = await supabase.from("group_members").insert({ group_id: groupId, student_id: studentId });

      if (error) throw error;

      await supabase.from("profiles").update({ group_id: groupId }).eq("id", studentId);

      toast({ title: "เพิ่มนักศึกษาสำเร็จ" });
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
    try {
      const { error } = await supabase.from("group_members").delete().eq("id", memberId);

      if (error) throw error;

      await supabase.from("profiles").update({ group_id: null }).eq("id", studentId);

      toast({ title: "ลบนักศึกษาสำเร็จ" });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  // Filter users based on search and role
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.student_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.employee_id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === "all" || u.user_roles?.[0]?.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // Filter groups based on search
  const filteredGroups = groups.filter(
    (g) =>
      g.name?.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
      g.major?.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
      g.year_level?.toLowerCase().includes(groupSearchQuery.toLowerCase()),
  );

  if (isLoading) {
    return (
      <DashboardLayout role="super_admin" userName="">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const studentCount = users.filter((u) => u.user_roles?.[0]?.role === "student").length;
  const teacherCount = users.filter((u) => u.user_roles?.[0]?.role === "teacher").length;
  const adminCount = users.filter((u) => u.user_roles?.[0]?.role === "admin").length;

  const students = users.filter((u) => u.user_roles?.[0]?.role === "student");
  const teachers = users.filter((u) => u.user_roles?.[0]?.role === "teacher");

  const dashboardStats = {
    totalStudents: studentCount,
    totalTeachers: teacherCount,
    totalGroups: groups.length,
    totalSessions: sessions.length,
    approvedSessions: sessions.filter((s) => s.status === "approved").length,
    pendingSessions: sessions.filter((s) => s.status === "pending").length,
    rejectedSessions: sessions.filter((s) => s.status === "rejected").length,
    sessionsByGroup: groups.map((g) => ({
      name: g.name,
      count: sessions.filter((s) => s.profiles?.group_id === g.id).length,
    })),
    sessionsByStatus: [
      { name: "อนุมัติแล้ว", value: sessions.filter((s) => s.status === "approved").length },
      { name: "รอตรวจสอบ", value: sessions.filter((s) => s.status === "pending").length },
      { name: "ไม่อนุมัติ", value: sessions.filter((s) => s.status === "rejected").length },
    ],
  };

  return (
    <DashboardLayout role="super_admin" userName={`${profile?.first_name || ""} ${profile?.last_name || ""}`}>
      <TooltipProvider>
        <div className="space-y-6 animate-in fade-in duration-500">
          <AppointmentCalendar role="super_admin" userId={user?.id || ""} />

          {/* Stats Cards with hover effects */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">นักศึกษา</CardTitle>
                <Users className="w-5 h-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{studentCount}</div>
                <p className="text-xs text-muted-foreground mt-1">ผู้ใช้งานทั้งหมด</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">อาจารย์</CardTitle>
                <Shield className="w-5 h-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{teacherCount}</div>
                <p className="text-xs text-muted-foreground mt-1">อาจารย์ผู้สอน</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">ผู้ดูแลระบบ</CardTitle>
                <Shield className="w-5 h-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{adminCount}</div>
                <p className="text-xs text-muted-foreground mt-1">แอดมินทั้งหมด</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">ใบ Coaching</CardTitle>
                <FileCheck className="w-5 h-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{sessions.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {sessions.filter((s) => s.status === "pending").length} รอตรวจสอบ
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-auto p-1">
              <TabsTrigger
                value="dashboard"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Dashboard
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                จัดการผู้ใช้
              </TabsTrigger>
              <TabsTrigger
                value="groups"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                จัดการกลุ่ม
              </TabsTrigger>
              <TabsTrigger
                value="line"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                LINE Notifications
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                ตั้งค่าระบบ
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4 animate-in fade-in duration-300">
              <DashboardStats stats={dashboardStats} />
            </TabsContent>

            <TabsContent value="users" className="space-y-4 animate-in fade-in duration-300">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        จัดการผู้ใช้งานทั้งหมด
                      </CardTitle>
                      <CardDescription>
                        เพิ่ม แก้ไข หรือลบผู้ใช้งานในระบบ ({filteredUsers.length} จาก {users.length})
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => exportReport("pdf")}>
                            <Download className="w-4 h-4 mr-2" />
                            PDF
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>ส่งออกเป็นไฟล์ PDF</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => exportReport("excel")}>
                            <Download className="w-4 h-4 mr-2" />
                            Excel
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>ส่งออกเป็นไฟล์ Excel</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => exportReport("csv")}>
                            <Download className="w-4 h-4 mr-2" />
                            CSV
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>ส่งออกเป็นไฟล์ CSV</TooltipContent>
                      </Tooltip>
                      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                        <DialogTrigger asChild>
                          <Button className="bg-primary hover:bg-primary/90">
                            <UserPlus className="w-4 h-4 mr-2" />
                            เพิ่มผู้ใช้
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle>
                            <DialogDescription>กรอกข้อมูลผู้ใช้ใหม่ เพื่อเพิ่มเข้าสู่ระบบ</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="firstName">
                                  ชื่อ <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="firstName"
                                  value={newUser.firstName}
                                  onChange={(e) => {
                                    setNewUser({ ...newUser, firstName: e.target.value });
                                    if (formErrors.firstName) setFormErrors({ ...formErrors, firstName: undefined });
                                  }}
                                  className={formErrors.firstName ? "border-red-500" : ""}
                                />
                                {formErrors.firstName && <p className="text-xs text-red-500">{formErrors.firstName}</p>}
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="lastName">
                                  นามสกุล <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="lastName"
                                  value={newUser.lastName}
                                  onChange={(e) => {
                                    setNewUser({ ...newUser, lastName: e.target.value });
                                    if (formErrors.lastName) setFormErrors({ ...formErrors, lastName: undefined });
                                  }}
                                  className={formErrors.lastName ? "border-red-500" : ""}
                                />
                                {formErrors.lastName && <p className="text-xs text-red-500">{formErrors.lastName}</p>}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="email">
                                อีเมล <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id="email"
                                type="email"
                                placeholder="example@email.com"
                                value={newUser.email}
                                onChange={(e) => {
                                  setNewUser({ ...newUser, email: e.target.value });
                                  if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                                }}
                                className={formErrors.email ? "border-red-500" : ""}
                              />
                              {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="password">
                                รหัสผ่าน <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  id="password"
                                  type={showPassword ? "text" : "password"}
                                  placeholder="อย่างน้อย 6 ตัวอักษร"
                                  value={newUser.password}
                                  onChange={(e) => {
                                    setNewUser({ ...newUser, password: e.target.value });
                                    if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
                                  }}
                                  className={formErrors.password ? "border-red-500 pr-10" : "pr-10"}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                              {formErrors.password && <p className="text-xs text-red-500">{formErrors.password}</p>}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="role">
                                บทบาท <span className="text-red-500">*</span>
                              </Label>
                              <Select
                                value={newUser.role}
                                onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                              >
                                <SelectTrigger id="role">
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
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setIsAddUserOpen(false);
                                setFormErrors({});
                              }}
                              disabled={isSubmitting}
                            >
                              ยกเลิก
                            </Button>
                            <Button onClick={handleAddUser} disabled={isSubmitting}>
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  กำลังเพิ่ม...
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  เพิ่มผู้ใช้
                                </>
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search and Filter */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="ค้นหาด้วยชื่อ, อีเมล, หรือรหัส..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-full md:w-[200px]">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">บทบาททั้งหมด</SelectItem>
                        <SelectItem value="student">นักศึกษา</SelectItem>
                        <SelectItem value="teacher">อาจารย์</SelectItem>
                        <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Users Table */}
                  {filteredUsers.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {searchQuery || roleFilter !== "all"
                          ? "ไม่พบผู้ใช้ที่ตรงกับเงื่อนไขการค้นหา"
                          : "ยังไม่มีผู้ใช้ในระบบ"}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>อีเมล</TableHead>
                            <TableHead>ชื่อ-นามสกุล</TableHead>
                            <TableHead>บทบาท</TableHead>
                            <TableHead>รหัส</TableHead>
                            <TableHead className="text-right">ดำเนินการ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((u: any) => (
                            <TableRow key={u.id} className="hover:bg-muted/50 transition-colors">
                              <TableCell className="font-medium">{u.email}</TableCell>
                              <TableCell>{`${u.first_name} ${u.last_name}`}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    u.user_roles?.[0]?.role === "super_admin"
                                      ? "default"
                                      : u.user_roles?.[0]?.role === "admin"
                                        ? "secondary"
                                        : u.user_roles?.[0]?.role === "teacher"
                                          ? "outline"
                                          : "outline"
                                  }
                                >
                                  {u.user_roles?.[0]?.role === "super_admin"
                                    ? "Super Admin"
                                    : u.user_roles?.[0]?.role === "admin"
                                      ? "ผู้ดูแลระบบ"
                                      : u.user_roles?.[0]?.role === "teacher"
                                        ? "อาจารย์"
                                        : "นักศึกษา"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {u.student_id || u.employee_id || "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteUser(u.id, u.email)}
                                      disabled={u.id === user?.id}
                                      className="hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {u.id === user?.id ? "ไม่สามารถลบตัวเองได้" : "ลบผู้ใช้"}
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="groups" className="space-y-4 animate-in fade-in duration-300">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle>จัดการกลุ่มนักศึกษา</CardTitle>
                      <CardDescription>
                        เพิ่ม แก้ไข หรือลบกลุ่มเรียน ({filteredGroups.length} จาก {groups.length})
                      </CardDescription>
                    </div>
                    <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90">
                          <UserPlus className="w-4 h-4 mr-2" />
                          เพิ่มกลุ่ม
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>เพิ่มกลุ่มใหม่</DialogTitle>
                          <DialogDescription>กรอกข้อมูลกลุ่มนักศึกษาใหม่</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="groupName">
                              ชื่อกลุ่ม <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="groupName"
                              placeholder="เช่น กลุ่ม 1, Section A"
                              value={newGroup.name}
                              onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="major">
                              สาขา <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="major"
                              placeholder="เช่น วิทยาการคอมพิวเตอร์"
                              value={newGroup.major}
                              onChange={(e) => setNewGroup({ ...newGroup, major: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="yearLevel">
                              ชั้นปี <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="yearLevel"
                              placeholder="เช่น 1, 2, 3, 4"
                              value={newGroup.yearLevel}
                              onChange={(e) => setNewGroup({ ...newGroup, yearLevel: e.target.value })}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAddGroupOpen(false)} disabled={isSubmitting}>
                            ยกเลิก
                          </Button>
                          <Button onClick={handleAddGroup} disabled={isSubmitting}>
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                กำลังเพิ่ม...
                              </>
                            ) : (
                              "เพิ่มกลุ่ม"
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Group Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="ค้นหากลุ่มด้วยชื่อ, สาขา, หรือชั้นปี..."
                      value={groupSearchQuery}
                      onChange={(e) => setGroupSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Groups Table */}
                  {filteredGroups.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {groupSearchQuery ? "ไม่พบกลุ่มที่ตรงกับเงื่อนไขการค้นหา" : "ยังไม่มีกลุ่มในระบบ"}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>ชื่อกลุ่ม</TableHead>
                            <TableHead>สาขา</TableHead>
                            <TableHead>ชั้นปี</TableHead>
                            <TableHead className="text-right">ดำเนินการ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredGroups.map((group: any) => (
                            <React.Fragment key={group.id}>
                              <TableRow className="hover:bg-muted/50 transition-colors">
                                <TableCell className="font-medium">{group.name}</TableCell>
                                <TableCell>{group.major}</TableCell>
                                <TableCell>{group.year_level}</TableCell>
                                <TableCell className="text-right space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedGroup(selectedGroup === group.id ? null : group.id)}
                                  >
                                    {selectedGroup === group.id ? "ซ่อน" : "จัดการ"}
                                  </Button>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteGroup(group.id, group.name)}
                                        className="hover:bg-red-50 hover:text-red-600"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>ลบกลุ่ม</TooltipContent>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                              {selectedGroup === group.id && (
                                <TableRow>
                                  <TableCell colSpan={4}>
                                    <div className="p-6 space-y-6 bg-muted/30 rounded-lg animate-in fade-in duration-200">
                                      {/* Teachers Section */}
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                          <Shield className="w-4 h-4 text-green-600" />
                                          <h4 className="font-semibold">อาจารย์ผู้รับผิดชอบ</h4>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                          {teacherAssignments
                                            .filter((a) => a.group_id === group.id)
                                            .map((assignment) => (
                                              <Badge
                                                key={assignment.id}
                                                variant="secondary"
                                                className="gap-2 py-1.5 px-3"
                                              >
                                                {assignment.profiles?.first_name} {assignment.profiles?.last_name}
                                                <button
                                                  onClick={() => handleRemoveTeacherAssignment(assignment.id)}
                                                  className="ml-1 hover:text-destructive transition-colors"
                                                >
                                                  ✕
                                                </button>
                                              </Badge>
                                            ))}
                                          {teacherAssignments.filter((a) => a.group_id === group.id).length === 0 && (
                                            <p className="text-sm text-muted-foreground">ยังไม่มีอาจารย์ผู้รับผิดชอบ</p>
                                          )}
                                        </div>
                                        <Select onValueChange={(teacherId) => handleAssignTeacher(group.id, teacherId)}>
                                          <SelectTrigger className="w-full md:w-[300px]">
                                            <SelectValue placeholder="เพิ่มอาจารย์" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {teachers.map((t) => (
                                              <SelectItem key={t.id} value={t.id}>
                                                {t.first_name} {t.last_name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      {/* Students Section */}
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                          <Users className="w-4 h-4 text-blue-600" />
                                          <h4 className="font-semibold">นักศึกษาในกลุ่ม</h4>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                          {groupMembers
                                            .filter((m) => m.group_id === group.id)
                                            .map((member) => (
                                              <Badge key={member.id} variant="outline" className="gap-2 py-1.5 px-3">
                                                {member.profiles?.first_name} {member.profiles?.last_name}(
                                                {member.profiles?.student_id})
                                                <button
                                                  onClick={() =>
                                                    handleRemoveStudentFromGroup(member.id, member.student_id)
                                                  }
                                                  className="ml-1 hover:text-destructive transition-colors"
                                                >
                                                  ✕
                                                </button>
                                              </Badge>
                                            ))}
                                          {groupMembers.filter((m) => m.group_id === group.id).length === 0 && (
                                            <p className="text-sm text-muted-foreground">ยังไม่มีนักศึกษาในกลุ่ม</p>
                                          )}
                                        </div>
                                        <Select
                                          onValueChange={(studentId) => handleAddStudentToGroup(group.id, studentId)}
                                        >
                                          <SelectTrigger className="w-full md:w-[300px]">
                                            <SelectValue placeholder="เพิ่มนักศึกษา" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {students
                                              .filter(
                                                (s) =>
                                                  !groupMembers.some(
                                                    (m) => m.student_id === s.id && m.group_id === group.id,
                                                  ),
                                              )
                                              .map((s) => (
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
                              )}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="line" className="space-y-4 animate-in fade-in duration-300">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle>จัดการ LINE Notifications</CardTitle>
                      <CardDescription>เพิ่ม แก้ไข หรือลบ LINE Channel (รองรับได้ถึง 5-6 channels)</CardDescription>
                    </div>
                    <Dialog open={isAddLineChannelOpen} onOpenChange={setIsAddLineChannelOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90">
                          <UserPlus className="w-4 h-4 mr-2" />
                          เพิ่ม Channel
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>เพิ่ม LINE Channel ใหม่</DialogTitle>
                          <DialogDescription>
                            กรอกข้อมูล Channel Access Token และ Channel Secret จาก LINE Developers Console
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="channelName">
                              ชื่อ Channel <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="channelName"
                              placeholder="เช่น LINE Group 1"
                              value={newLineChannel.name}
                              onChange={(e) => setNewLineChannel({ ...newLineChannel, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="description">คำอธิบาย</Label>
                            <Textarea
                              id="description"
                              placeholder="คำอธิบายเกี่ยวกับ channel นี้"
                              value={newLineChannel.description}
                              onChange={(e) => setNewLineChannel({ ...newLineChannel, description: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="accessToken">
                              Channel Access Token <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                              id="accessToken"
                              placeholder="Channel Access Token จาก LINE Developers"
                              value={newLineChannel.channelAccessToken}
                              onChange={(e) =>
                                setNewLineChannel({ ...newLineChannel, channelAccessToken: e.target.value })
                              }
                              rows={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="secret">
                              Channel Secret <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="secret"
                              placeholder="Channel Secret จาก LINE Developers"
                              value={newLineChannel.channelSecret}
                              onChange={(e) => setNewLineChannel({ ...newLineChannel, channelSecret: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="groupId">Group ID (ถ้ามี)</Label>
                            <Input
                              id="groupId"
                              placeholder="Group ID สำหรับส่งข้อความ (optional)"
                              value={newLineChannel.groupId}
                              onChange={(e) => setNewLineChannel({ ...newLineChannel, groupId: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="notificationType">ประเภทการแจ้งเตือน</Label>
                            <Select
                              value={newLineChannel.notificationType}
                              onValueChange={(value) =>
                                setNewLineChannel({ ...newLineChannel, notificationType: value })
                              }
                            >
                              <SelectTrigger id="notificationType">
                                <SelectValue placeholder="เลือกประเภท" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="group">Group Message</SelectItem>
                                <SelectItem value="broadcast">Broadcast Message</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setIsAddLineChannelOpen(false)}
                            disabled={isSubmitting}
                          >
                            ยกเลิก
                          </Button>
                          <Button onClick={handleAddLineChannel} disabled={isSubmitting}>
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                กำลังเพิ่ม...
                              </>
                            ) : (
                              "เพิ่ม Channel"
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {lineChannels.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        ยังไม่มี LINE Channel ในระบบ คลิก "เพิ่ม Channel" เพื่อเริ่มต้น
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>ชื่อ</TableHead>
                            <TableHead>คำอธิบาย</TableHead>
                            <TableHead>ประเภท</TableHead>
                            <TableHead>สถานะ</TableHead>
                            <TableHead className="text-right">ดำเนินการ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineChannels.map((channel: any) => (
                            <TableRow key={channel.id} className="hover:bg-muted/50 transition-colors">
                              <TableCell className="font-medium">{channel.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                {channel.description || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {channel.notification_type === "group"
                                    ? "Group"
                                    : channel.notification_type === "broadcast"
                                      ? "Broadcast"
                                      : "-"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleLineChannel(channel.id, !channel.enabled)}
                                  className={cn(
                                    "transition-colors",
                                    channel.enabled
                                      ? "text-green-600 hover:text-green-700"
                                      : "text-red-600 hover:text-red-700",
                                  )}
                                >
                                  {channel.enabled ? (
                                    <>
                                      <CheckCircle2 className="w-4 h-4 mr-1" />
                                      เปิด
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-4 h-4 mr-1" />
                                      ปิด
                                    </>
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell className="text-right">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteLineChannel(channel.id, channel.name)}
                                      className="hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>ลบ Channel</TooltipContent>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 animate-in fade-in duration-300">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    ตั้งค่าระบบ
                  </CardTitle>
                  <CardDescription>กำหนดค่าต่างๆ ของระบบ</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="minSessions" className="text-base">
                        จำนวนครั้งขั้นต่ำสำหรับ Coaching
                      </Label>
                      <Input
                        id="minSessions"
                        type="number"
                        min="1"
                        value={minSessions}
                        onChange={(e) => setMinSessions(e.target.value)}
                        className="max-w-xs"
                      />
                      <p className="text-sm text-muted-foreground">
                        กำหนดจำนวนครั้งขั้นต่ำที่นักศึกษาต้องเข้าพบอาจารย์ที่ปรึกษา
                      </p>
                    </div>
                    <Button onClick={updateSettings} className="w-full md:w-auto">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      บันทึกการตั้งค่า
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  ยืนยันการลบ
                </DialogTitle>
                <DialogDescription>การดำเนินการนี้ไม่สามารถย้อนกลับได้</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm">
                  คุณแน่ใจหรือไม่ที่จะลบ{" "}
                  {itemToDelete?.type === "user" ? "ผู้ใช้" : itemToDelete?.type === "group" ? "กลุ่ม" : "LINE Channel"}{" "}
                  <span className="font-semibold">{itemToDelete?.name}</span>?
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setItemToDelete(null);
                  }}
                >
                  ยกเลิก
                </Button>
                <Button variant="destructive" onClick={handleDeleteConfirm}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  ลบ
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
