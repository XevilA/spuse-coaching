import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, FileCheck, Settings, UserPlus, Trash2, Download, Edit, Lock, Unlock, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { LINENotificationSender } from "@/components/LINENotificationSender";

export default function SuperAdmin() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [lineChannels, setLineChannels] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog states
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isAddLineChannelOpen, setIsAddLineChannelOpen] = useState(false);
  const [isEditLineChannelOpen, setIsEditLineChannelOpen] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isEditTeacherOpen, setIsEditTeacherOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // Form states
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [editingLineChannel, setEditingLineChannel] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{ type: string; id: string; name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newTeacher, setNewTeacher] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    groupIds: [] as string[],
  });

  const [editTeacher, setEditTeacher] = useState({
    firstName: "",
    lastName: "",
    groupIds: [] as string[],
  });

  const [newGroup, setNewGroup] = useState({
    name: "",
    major: "",
    yearLevel: "",
  });

  const [editGroup, setEditGroup] = useState({
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
    notificationType: "broadcast" as "group" | "broadcast",
  });

  const [editLineChannel, setEditLineChannel] = useState({
    name: "",
    description: "",
    channelAccessToken: "",
    channelSecret: "",
    groupId: "",
    notificationType: "broadcast" as "group" | "broadcast",
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel("superadmin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "student_groups" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "teacher_assignments" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "coaching_sessions" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "line_notifications" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
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
      const [profileRes, usersRes, groupsRes, sessionsRes, lineChannelsRes, assignmentsRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("profiles").select("*, user_roles(role)"),
        supabase.from("student_groups").select("*"),
        supabase.from("coaching_sessions").select("*, profiles!coaching_sessions_student_id_fkey(group_id)"),
        supabase.from("line_notifications").select("*").order("name"),
        supabase.from("teacher_assignments").select("*, profiles!teacher_assignments_teacher_id_fkey(first_name, last_name), student_groups(name)"),
        supabase.from("group_members").select("*, profiles!group_members_student_id_fkey(first_name, last_name, student_id)"),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (usersRes.data) setUsers(usersRes.data);
      if (groupsRes.data) setGroups(groupsRes.data);
      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (lineChannelsRes.data) setLineChannels(lineChannelsRes.data);
      if (assignmentsRes.data) setTeacherAssignments(assignmentsRes.data);
      if (membersRes.data) setGroupMembers(membersRes.data);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Group Management
  const handleAddGroup = async () => {
    if (!newGroup.name || !newGroup.major || !newGroup.yearLevel) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
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

      toast({ title: "เพิ่มกลุ่มสำเร็จ", description: `เพิ่มกลุ่ม ${newGroup.name} แล้ว` });
      setIsAddGroupOpen(false);
      setNewGroup({ name: "", major: "", yearLevel: "" });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "ไม่สามารถเพิ่มกลุ่มได้", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditGroup = async () => {
    if (!editGroup.name || !editGroup.major || !editGroup.yearLevel || !editingGroup) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("student_groups")
        .update({
          name: editGroup.name,
          major: editGroup.major,
          year_level: editGroup.yearLevel,
        })
        .eq("id", editingGroup.id);

      if (error) throw error;

      toast({ title: "แก้ไขกลุ่มสำเร็จ" });
      setIsEditGroupOpen(false);
      setEditingGroup(null);
      setEditGroup({ name: "", major: "", yearLevel: "" });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "ไม่สามารถแก้ไขกลุ่มได้", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditGroupDialog = (group: any) => {
    setEditingGroup(group);
    setEditGroup({
      name: group.name,
      major: group.major,
      yearLevel: group.year_level,
    });
    setIsEditGroupOpen(true);
  };

  // Teacher Management
  const handleAddTeacher = async () => {
    if (!newTeacher.email || !newTeacher.password || !newTeacher.firstName || !newTeacher.lastName) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }

    if (!newTeacher.email.endsWith("@spu.ac.th")) {
      toast({ variant: "destructive", title: "อีเมลต้องเป็นโดเมน @spu.ac.th เท่านั้น" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newTeacher.email,
        password: newTeacher.password,
        options: {
          data: {
            first_name: newTeacher.firstName,
            last_name: newTeacher.lastName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: newTeacher.firstName,
          last_name: newTeacher.lastName,
        })
        .eq("id", authData.user.id);

      if (profileError) throw profileError;

      if (newTeacher.groupIds.length > 0) {
        const assignments = newTeacher.groupIds.map((groupId) => ({
          teacher_id: authData.user.id,
          group_id: groupId,
        }));

        const { error: assignError } = await supabase.from("teacher_assignments").insert(assignments);
        if (assignError) throw assignError;
      }

      toast({ title: "สร้างบัญชีสำเร็จ", description: `สร้างบัญชีอาจารย์ ${newTeacher.email} เรียบร้อยแล้ว` });
      setNewTeacher({ email: "", password: "", firstName: "", lastName: "", groupIds: [] });
      setIsAddTeacherOpen(false);
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditTeacherDialog = (teacher: any) => {
    setEditingTeacher(teacher);
    const teacherGroupIds = teacherAssignments
      .filter((ta: any) => ta.teacher_id === teacher.id)
      .map((ta: any) => ta.group_id);
    
    setEditTeacher({
      firstName: teacher.first_name,
      lastName: teacher.last_name,
      groupIds: teacherGroupIds,
    });
    setIsEditTeacherOpen(true);
  };

  const handleEditTeacherSubmit = async () => {
    if (!editTeacher.firstName || !editTeacher.lastName || !editingTeacher) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: editTeacher.firstName.trim(),
          last_name: editTeacher.lastName.trim(),
        })
        .eq("id", editingTeacher.id);

      if (profileError) throw profileError;

      await supabase.from("teacher_assignments").delete().eq("teacher_id", editingTeacher.id);

      if (editTeacher.groupIds.length > 0) {
        const assignments = editTeacher.groupIds.map((groupId) => ({
          teacher_id: editingTeacher.id,
          group_id: groupId,
        }));

        const { error: assignError } = await supabase.from("teacher_assignments").insert(assignments);
        if (assignError) throw assignError;
      }

      toast({ title: "แก้ไขสำเร็จ" });
      setIsEditTeacherOpen(false);
      setEditingTeacher(null);
      setEditTeacher({ firstName: "", lastName: "", groupIds: [] });
      await fetchData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLock = async (teacherId: string, nextLocked: boolean) => {
    try {
      const { error } = await supabase.from("profiles").update({ is_locked: nextLocked }).eq("id", teacherId);
      if (error) throw error;
      toast({ title: nextLocked ? "ล็อกผู้ใช้แล้ว" : "ปลดล็อกผู้ใช้แล้ว" });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
    }
  };

  const handleSendResetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
      if (error) throw error;
      toast({ title: "ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว", description: `ไปที่ ${email}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "ส่งลิงก์รีเซ็ตไม่สำเร็จ", description: error.message });
    }
  };

  // LINE Channel Management
  const handleAddLineChannel = async () => {
    if (!newLineChannel.name || !newLineChannel.channelAccessToken || !newLineChannel.channelSecret || !newLineChannel.notificationType) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" });
      return;
    }

    if (newLineChannel.notificationType === "group" && !newLineChannel.groupId) {
      toast({ variant: "destructive", title: "กรุณากรอก Group ID สำหรับ Group Message" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("line_notifications").insert({
        name: newLineChannel.name,
        description: newLineChannel.description,
        channel_access_token: newLineChannel.channelAccessToken,
        channel_secret: newLineChannel.channelSecret,
        group_id: newLineChannel.notificationType === "group" ? newLineChannel.groupId : null,
        notification_type: newLineChannel.notificationType,
        enabled: true,
      });

      if (error) throw error;

      toast({ title: "เพิ่ม LINE Channel สำเร็จ", description: `เพิ่ม ${newLineChannel.name} แล้ว` });
      setIsAddLineChannelOpen(false);
      setNewLineChannel({
        name: "",
        description: "",
        channelAccessToken: "",
        channelSecret: "",
        groupId: "",
        notificationType: "broadcast",
      });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "ไม่สามารถเพิ่ม LINE Channel ได้", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditLineChannelDialog = (channel: any) => {
    setEditingLineChannel(channel);
    setEditLineChannel({
      name: channel.name,
      description: channel.description || "",
      channelAccessToken: channel.channel_access_token,
      channelSecret: channel.channel_secret,
      groupId: channel.group_id || "",
      notificationType: channel.notification_type,
    });
    setIsEditLineChannelOpen(true);
  };

  const handleEditLineChannel = async () => {
    if (!editLineChannel.name || !editLineChannel.channelAccessToken || !editLineChannel.channelSecret || !editingLineChannel) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }

    if (editLineChannel.notificationType === "group" && !editLineChannel.groupId) {
      toast({ variant: "destructive", title: "กรุณากรอก Group ID สำหรับ Group Message" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("line_notifications")
        .update({
          name: editLineChannel.name,
          description: editLineChannel.description,
          channel_access_token: editLineChannel.channelAccessToken,
          channel_secret: editLineChannel.channelSecret,
          group_id: editLineChannel.notificationType === "group" ? editLineChannel.groupId : null,
          notification_type: editLineChannel.notificationType,
        })
        .eq("id", editingLineChannel.id);

      if (error) throw error;

      toast({ title: "แก้ไข LINE Channel สำเร็จ" });
      setIsEditLineChannelOpen(false);
      setEditingLineChannel(null);
      setEditLineChannel({
        name: "",
        description: "",
        channelAccessToken: "",
        channelSecret: "",
        groupId: "",
        notificationType: "broadcast",
      });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "ไม่สามารถแก้ไข LINE Channel ได้", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLineChannel = async (channelId: string, enabled: boolean) => {
    try {
      const { error } = await supabase.from("line_notifications").update({ enabled }).eq("id", channelId);
      if (error) throw error;
      toast({ title: enabled ? "เปิดใช้งานแล้ว" : "ปิดใช้งานแล้ว" });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
    }
  };

  // Delete handlers
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === "group") {
        const { error } = await supabase.from("student_groups").delete().eq("id", itemToDelete.id);
        if (error) throw error;
        toast({ title: "ลบกลุ่มสำเร็จ" });
      } else if (itemToDelete.type === "line_channel") {
        const { error } = await supabase.from("line_notifications").delete().eq("id", itemToDelete.id);
        if (error) throw error;
        toast({ title: "ลบ LINE Channel สำเร็จ" });
      } else if (itemToDelete.type === "teacher") {
        const { error: assignmentError } = await supabase.from("teacher_assignments").delete().eq("teacher_id", itemToDelete.id);
        if (assignmentError) throw assignmentError;

        const { error: deleteError } = await supabase.auth.admin.deleteUser(itemToDelete.id);
        if (deleteError) throw deleteError;
        toast({ title: "ลบอาจารย์สำเร็จ" });
      }

      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
    } finally {
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    setItemToDelete({ type: "group", id: groupId, name: groupName });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteLineChannel = (channelId: string, channelName: string) => {
    setItemToDelete({ type: "line_channel", id: channelId, name: channelName });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteTeacher = (teacherId: string, teacherName: string) => {
    setItemToDelete({ type: "teacher", id: teacherId, name: teacherName });
    setDeleteConfirmOpen(true);
  };

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
        </div>
      </DashboardLayout>
    );
  }

  const students = users.filter((u) => u.user_roles?.[0]?.role === "student");
  const teachers = users.filter((u) => u.user_roles?.[0]?.role === "teacher");
  const admins = users.filter((u) => u.user_roles?.[0]?.role === "admin");

  return (
    <DashboardLayout role="super_admin" userName={`${profile?.first_name || ""} ${profile?.last_name || ""}`}>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">นักศึกษา</CardTitle>
              <Users className="w-5 h-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{students.length}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">อาจารย์</CardTitle>
              <Shield className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{teachers.length}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ผู้ดูแลระบบ</CardTitle>
              <Shield className="w-5 h-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{admins.length}</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ใบ Coaching</CardTitle>
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

        <Tabs defaultValue="teachers" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="teachers">จัดการอาจารย์</TabsTrigger>
            <TabsTrigger value="groups">จัดการกลุ่ม</TabsTrigger>
            <TabsTrigger value="line">LINE Broadcast</TabsTrigger>
            <TabsTrigger value="settings">ตั้งค่า</TabsTrigger>
          </TabsList>

          {/* Teachers Tab */}
          <TabsContent value="teachers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>จัดการอาจารย์</CardTitle>
                    <CardDescription>เพิ่ม แก้ไข หรือลบอาจารย์</CardDescription>
                  </div>
                  <Dialog open={isAddTeacherOpen} onOpenChange={setIsAddTeacherOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="w-4 h-4 mr-2" />
                        เพิ่มอาจารย์
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>เพิ่มอาจารย์ใหม่</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="teacher-email">อีเมล (@spu.ac.th)</Label>
                          <Input
                            id="teacher-email"
                            type="email"
                            value={newTeacher.email}
                            onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                            placeholder="example@spu.ac.th"
                          />
                        </div>
                        <div>
                          <Label htmlFor="teacher-password">รหัสผ่าน</Label>
                          <Input
                            id="teacher-password"
                            type="password"
                            value={newTeacher.password}
                            onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="teacher-firstname">ชื่อ</Label>
                          <Input
                            id="teacher-firstname"
                            value={newTeacher.firstName}
                            onChange={(e) => setNewTeacher({ ...newTeacher, firstName: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="teacher-lastname">นามสกุล</Label>
                          <Input
                            id="teacher-lastname"
                            value={newTeacher.lastName}
                            onChange={(e) => setNewTeacher({ ...newTeacher, lastName: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>กลุ่มที่รับผิดชอบ</Label>
                          <Select
                            value={newTeacher.groupIds[0] || ""}
                            onValueChange={(value) => {
                              const currentIds = newTeacher.groupIds;
                              if (currentIds.includes(value)) {
                                setNewTeacher({ ...newTeacher, groupIds: currentIds.filter(id => id !== value) });
                              } else {
                                setNewTeacher({ ...newTeacher, groupIds: [...currentIds, value] });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="เลือกกลุ่ม" />
                            </SelectTrigger>
                            <SelectContent>
                              {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                  {group.name} - {group.major} ปี {group.year_level}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {newTeacher.groupIds.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {newTeacher.groupIds.map(id => {
                                const group = groups.find(g => g.id === id);
                                return group ? (
                                  <Badge key={id} variant="secondary">
                                    {group.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddTeacher} disabled={isSubmitting}>
                          {isSubmitting ? "กำลังเพิ่ม..." : "เพิ่มอาจารย์"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อ-นามสกุล</TableHead>
                      <TableHead>อีเมล</TableHead>
                      <TableHead>กลุ่มที่รับผิดชอบ</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.map((teacher) => {
                      const assignments = teacherAssignments.filter(ta => ta.teacher_id === teacher.id);
                      return (
                        <TableRow key={teacher.id}>
                          <TableCell className="font-medium">
                            {teacher.first_name} {teacher.last_name}
                          </TableCell>
                          <TableCell>{teacher.email}</TableCell>
                          <TableCell>
                            {assignments.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {assignments.map((assignment: any) => (
                                  <Badge key={assignment.id} variant="outline">
                                    {assignment.student_groups?.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">ไม่มีกลุ่ม</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {teacher.is_locked ? (
                              <Badge variant="destructive">ล็อก</Badge>
                            ) : (
                              <Badge variant="secondary">ปกติ</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditTeacherDialog(teacher)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleLock(teacher.id, !teacher.is_locked)}
                              >
                                {teacher.is_locked ? (
                                  <Unlock className="w-4 h-4" />
                                ) : (
                                  <Lock className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendResetPassword(teacher.email)}
                              >
                                รีเซ็ต
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteTeacher(teacher.id, `${teacher.first_name} ${teacher.last_name}`)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>จัดการกลุ่มนักศึกษา</CardTitle>
                    <CardDescription>เพิ่ม แก้ไข หรือลบกลุ่ม</CardDescription>
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
                        <div>
                          <Label htmlFor="group-name">ชื่อกลุ่ม</Label>
                          <Input
                            id="group-name"
                            value={newGroup.name}
                            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="group-major">สาขาวิชา</Label>
                          <Input
                            id="group-major"
                            value={newGroup.major}
                            onChange={(e) => setNewGroup({ ...newGroup, major: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="group-year">ปีการศึกษา</Label>
                          <Input
                            id="group-year"
                            value={newGroup.yearLevel}
                            onChange={(e) => setNewGroup({ ...newGroup, yearLevel: e.target.value })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddGroup} disabled={isSubmitting}>
                          {isSubmitting ? "กำลังเพิ่ม..." : "เพิ่มกลุ่ม"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อกลุ่ม</TableHead>
                      <TableHead>สาขาวิชา</TableHead>
                      <TableHead>ปีการศึกษา</TableHead>
                      <TableHead>จำนวนสมาชิก</TableHead>
                      <TableHead>จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((group) => {
                      const memberCount = groupMembers.filter(m => m.group_id === group.id).length;
                      return (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium">{group.name}</TableCell>
                          <TableCell>{group.major}</TableCell>
                          <TableCell>{group.year_level}</TableCell>
                          <TableCell>{memberCount} คน</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditGroupDialog(group)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteGroup(group.id, group.name)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LINE Broadcast Tab */}
          <TabsContent value="line" className="space-y-4">
            <LINENotificationSender userId={user?.id || ""} role="super_admin" />
            
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>จัดการ LINE Channels</CardTitle>
                    <CardDescription>เพิ่ม แก้ไข หรือลบ LINE Channel</CardDescription>
                  </div>
                  <Dialog open={isAddLineChannelOpen} onOpenChange={setIsAddLineChannelOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        เพิ่ม Channel
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>เพิ่ม LINE Channel ใหม่</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="channel-name">ชื่อ Channel</Label>
                          <Input
                            id="channel-name"
                            value={newLineChannel.name}
                            onChange={(e) => setNewLineChannel({ ...newLineChannel, name: e.target.value })}
                            placeholder="เช่น: ช่องทางแจ้งเตือนนักศึกษา"
                          />
                        </div>
                        <div>
                          <Label htmlFor="channel-description">คำอธิบาย</Label>
                          <Textarea
                            id="channel-description"
                            value={newLineChannel.description}
                            onChange={(e) => setNewLineChannel({ ...newLineChannel, description: e.target.value })}
                            placeholder="คำอธิบายเกี่ยวกับ Channel นี้"
                          />
                        </div>
                        <div>
                          <Label htmlFor="channel-type">ประเภท</Label>
                          <Select
                            value={newLineChannel.notificationType}
                            onValueChange={(value: "group" | "broadcast") => 
                              setNewLineChannel({ ...newLineChannel, notificationType: value })
                            }
                          >
                            <SelectTrigger id="channel-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="broadcast">Broadcast (ส่งถึงทุกคน)</SelectItem>
                              <SelectItem value="group">Group (ส่งถึงกลุ่มเฉพาะ)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {newLineChannel.notificationType === "group" && (
                          <div>
                            <Label htmlFor="channel-group-id">Group ID</Label>
                            <Input
                              id="channel-group-id"
                              value={newLineChannel.groupId}
                              onChange={(e) => setNewLineChannel({ ...newLineChannel, groupId: e.target.value })}
                              placeholder="LINE Group ID"
                            />
                          </div>
                        )}
                        <div>
                          <Label htmlFor="channel-token">Channel Access Token</Label>
                          <Textarea
                            id="channel-token"
                            value={newLineChannel.channelAccessToken}
                            onChange={(e) => setNewLineChannel({ ...newLineChannel, channelAccessToken: e.target.value })}
                            placeholder="จาก LINE Developers Console"
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label htmlFor="channel-secret">Channel Secret</Label>
                          <Input
                            id="channel-secret"
                            value={newLineChannel.channelSecret}
                            onChange={(e) => setNewLineChannel({ ...newLineChannel, channelSecret: e.target.value })}
                            placeholder="จาก LINE Developers Console"
                          />
                        </div>
                        <Alert>
                          <AlertDescription>
                            <strong>วิธีการใช้งาน:</strong>
                            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                              <li>ไปที่ LINE Developers Console (developers.line.biz)</li>
                              <li>สร้าง Messaging API channel</li>
                              <li>คัดลอก Channel Access Token และ Channel Secret มาใส่</li>
                              <li>สำหรับ Group Message ต้องเพิ่ม Bot เข้ากลุ่มและหา Group ID</li>
                            </ul>
                          </AlertDescription>
                        </Alert>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddLineChannel} disabled={isSubmitting}>
                          {isSubmitting ? "กำลังเพิ่ม..." : "เพิ่ม Channel"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อ Channel</TableHead>
                      <TableHead>คำอธิบาย</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineChannels.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          ยังไม่มี LINE Channel กรุณาเพิ่ม
                        </TableCell>
                      </TableRow>
                    ) : (
                      lineChannels.map((channel) => (
                        <TableRow key={channel.id}>
                          <TableCell className="font-medium">{channel.name}</TableCell>
                          <TableCell>{channel.description || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={channel.notification_type === "broadcast" ? "default" : "secondary"}>
                              {channel.notification_type === "broadcast" ? "Broadcast" : "Group"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={channel.enabled}
                                onCheckedChange={(checked) => handleToggleLineChannel(channel.id, checked)}
                              />
                              <span className="text-sm">
                                {channel.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditLineChannelDialog(channel)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteLineChannel(channel.id, channel.name)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  ตั้งค่าระบบ
                </CardTitle>
                <CardDescription>จัดการการตั้งค่าต่างๆ ของระบบ</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertDescription>
                    ส่วนตั้งค่าเพิ่มเติมจะถูกเพิ่มในอนาคต
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Teacher Dialog */}
        <Dialog open={isEditTeacherOpen} onOpenChange={setIsEditTeacherOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>แก้ไขข้อมูลอาจารย์</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-teacher-firstname">ชื่อ</Label>
                <Input
                  id="edit-teacher-firstname"
                  value={editTeacher.firstName}
                  onChange={(e) => setEditTeacher({ ...editTeacher, firstName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-teacher-lastname">นามสกุล</Label>
                <Input
                  id="edit-teacher-lastname"
                  value={editTeacher.lastName}
                  onChange={(e) => setEditTeacher({ ...editTeacher, lastName: e.target.value })}
                />
              </div>
              <div>
                <Label>กลุ่มที่รับผิดชอบ</Label>
                <Select
                  value={editTeacher.groupIds[0] || ""}
                  onValueChange={(value) => {
                    const currentIds = editTeacher.groupIds;
                    if (currentIds.includes(value)) {
                      setEditTeacher({ ...editTeacher, groupIds: currentIds.filter(id => id !== value) });
                    } else {
                      setEditTeacher({ ...editTeacher, groupIds: [...currentIds, value] });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกกลุ่ม" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} - {group.major} ปี {group.year_level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editTeacher.groupIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editTeacher.groupIds.map(id => {
                      const group = groups.find(g => g.id === id);
                      return group ? (
                        <Badge key={id} variant="secondary">
                          {group.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleEditTeacherSubmit} disabled={isSubmitting}>
                {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Group Dialog */}
        <Dialog open={isEditGroupOpen} onOpenChange={setIsEditGroupOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>แก้ไขกลุ่ม</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-group-name">ชื่อกลุ่ม</Label>
                <Input
                  id="edit-group-name"
                  value={editGroup.name}
                  onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-group-major">สาขาวิชา</Label>
                <Input
                  id="edit-group-major"
                  value={editGroup.major}
                  onChange={(e) => setEditGroup({ ...editGroup, major: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-group-year">ปีการศึกษา</Label>
                <Input
                  id="edit-group-year"
                  value={editGroup.yearLevel}
                  onChange={(e) => setEditGroup({ ...editGroup, yearLevel: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleEditGroup} disabled={isSubmitting}>
                {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit LINE Channel Dialog */}
        <Dialog open={isEditLineChannelOpen} onOpenChange={setIsEditLineChannelOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>แก้ไข LINE Channel</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-channel-name">ชื่อ Channel</Label>
                <Input
                  id="edit-channel-name"
                  value={editLineChannel.name}
                  onChange={(e) => setEditLineChannel({ ...editLineChannel, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-channel-description">คำอธิบาย</Label>
                <Textarea
                  id="edit-channel-description"
                  value={editLineChannel.description}
                  onChange={(e) => setEditLineChannel({ ...editLineChannel, description: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-channel-type">ประเภท</Label>
                <Select
                  value={editLineChannel.notificationType}
                  onValueChange={(value: "group" | "broadcast") => 
                    setEditLineChannel({ ...editLineChannel, notificationType: value })
                  }
                >
                  <SelectTrigger id="edit-channel-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="broadcast">Broadcast</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editLineChannel.notificationType === "group" && (
                <div>
                  <Label htmlFor="edit-channel-group-id">Group ID</Label>
                  <Input
                    id="edit-channel-group-id"
                    value={editLineChannel.groupId}
                    onChange={(e) => setEditLineChannel({ ...editLineChannel, groupId: e.target.value })}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="edit-channel-token">Channel Access Token</Label>
                <Textarea
                  id="edit-channel-token"
                  value={editLineChannel.channelAccessToken}
                  onChange={(e) => setEditLineChannel({ ...editLineChannel, channelAccessToken: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-channel-secret">Channel Secret</Label>
                <Input
                  id="edit-channel-secret"
                  value={editLineChannel.channelSecret}
                  onChange={(e) => setEditLineChannel({ ...editLineChannel, channelSecret: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleEditLineChannel} disabled={isSubmitting}>
                {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ยืนยันการลบ</DialogTitle>
            </DialogHeader>
            <p>
              คุณแน่ใจหรือไม่ที่จะลบ {itemToDelete?.name}?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                ลบ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}