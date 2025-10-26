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
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isAddLineChannelOpen, setIsAddLineChannelOpen] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [newTeacher, setNewTeacher] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    groupIds: [] as string[],
  });
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: string; id: string; name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // NEW: Track assignment operations
  const [isAssigningTeacher, setIsAssigningTeacher] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");

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

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    setItemToDelete({ type: "group", id: groupId, name: groupName });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteLineChannel = (channelId: string, channelName: string) => {
    setItemToDelete({ type: "line_channel", id: channelId, name: channelName });
    setDeleteConfirmOpen(true);
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

  const handleEditGroup = async () => {
    if (!editGroup.name || !editGroup.major || !editGroup.yearLevel) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกข้อมูลให้ครบถ้วน",
      });
      return;
    }

    if (!editingGroup) return;

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

      toast({
        title: "แก้ไขกลุ่มสำเร็จ",
        description: `แก้ไขกลุ่ม ${editGroup.name} แล้ว`,
      });

      setIsEditGroupOpen(false);
      setEditingGroup(null);
      setEditGroup({ name: "", major: "", yearLevel: "" });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถแก้ไขกลุ่มได้",
        description: error.message,
      });
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

  const handleAddTeacher = async () => {
    if (!newTeacher.email || !newTeacher.password || !newTeacher.firstName || !newTeacher.lastName) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกข้อมูลให้ครบถ้วน",
      });
      return;
    }

    if (!newTeacher.email.endsWith("@spu.ac.th")) {
      toast({
        variant: "destructive",
        title: "อีเมลต้องเป็นโดเมน @spu.ac.th เท่านั้น",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create user account
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

      // Update profile with name
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: newTeacher.firstName,
          last_name: newTeacher.lastName,
        })
        .eq("id", authData.user.id);

      if (profileError) throw profileError;

      // Assign to groups
      if (newTeacher.groupIds.length > 0) {
        const assignments = newTeacher.groupIds.map((groupId) => ({
          teacher_id: authData.user.id,
          group_id: groupId,
        }));

        const { error: assignError } = await supabase
          .from("teacher_assignments")
          .insert(assignments);

        if (assignError) throw assignError;
      }

      toast({
        title: "สร้างบัญชีสำเร็จ",
        description: `สร้างบัญชีอาจารย์ ${newTeacher.email} เรียบร้อยแล้ว`,
      });

      setNewTeacher({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        groupIds: [],
      });
      setIsAddTeacherOpen(false);
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
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

  // FIXED: Improved teacher assignment with validation
  const handleAssignTeacher = async (groupId: string, teacherId: string) => {
    if (!teacherId) {
      toast({
        variant: "destructive",
        title: "กรุณาเลือกอาจารย์",
      });
      return;
    }

    // Check if teacher is already assigned to this group
    const isAlreadyAssigned = teacherAssignments.some(
      (assignment) => assignment.group_id === groupId && assignment.teacher_id === teacherId,
    );

    if (isAlreadyAssigned) {
      toast({
        variant: "destructive",
        title: "อาจารย์ถูกมอบหมายแล้ว",
        description: "อาจารย์ท่านนี้ได้รับมอบหมายให้ดูแลกลุ่มนี้แล้ว",
      });
      return;
    }

    setIsAssigningTeacher(true);
    console.log("Assigning teacher:", { groupId, teacherId });

    try {
      const { data, error } = await supabase
        .from("teacher_assignments")
        .insert({
          group_id: groupId,
          teacher_id: teacherId,
        })
        .select();

      if (error) {
        console.error("Teacher assignment error:", error);
        throw error;
      }

      console.log("Teacher assigned successfully:", data);

      toast({
        title: "มอบหมายอาจารย์สำเร็จ",
        description: "เพิ่มอาจารย์ผู้รับผิดชอบกลุ่มแล้ว",
      });

      // Reset selection
      setSelectedTeacher("");

      if (user) await fetchData(user.id);
    } catch (error: any) {
      console.error("Error in handleAssignTeacher:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถมอบหมายอาจารย์ได้",
      });
    } finally {
      setIsAssigningTeacher(false);
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

  // FIXED: Improved student assignment with validation
  const handleAddStudentToGroup = async (groupId: string, studentId: string) => {
    if (!studentId) {
      toast({
        variant: "destructive",
        title: "กรุณาเลือกนักศึกษา",
      });
      return;
    }

    // Check if student is already in this group
    const isInGroup = groupMembers.some((member) => member.student_id === studentId && member.group_id === groupId);

    if (isInGroup) {
      toast({
        variant: "destructive",
        title: "นักศึกษาอยู่ในกลุ่มแล้ว",
        description: "นักศึกษาท่านนี้อยู่ในกลุ่มนี้แล้ว",
      });
      return;
    }

    // Check if student is in another group
    const existingMember = groupMembers.find((member) => member.student_id === studentId);
    if (existingMember) {
      const otherGroup = groups.find((g) => g.id === existingMember.group_id);
      toast({
        variant: "destructive",
        title: "นักศึกษาอยู่ในกลุ่มอื่นแล้ว",
        description: `นักศึกษาท่านนี้อยู่ใน ${otherGroup?.name || "กลุ่มอื่น"} แล้ว กรุณาลบออกจากกลุ่มเดิมก่อน`,
      });
      return;
    }

    setIsAddingStudent(true);
    console.log("Adding student to group:", { groupId, studentId });

    try {
      // Insert into group_members
      const { data: memberData, error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: groupId,
          student_id: studentId,
        })
        .select();

      if (memberError) {
        console.error("Group member insert error:", memberError);
        throw memberError;
      }

      console.log("Group member inserted:", memberData);

      // Update profile with group_id
      const { error: profileError } = await supabase.from("profiles").update({ group_id: groupId }).eq("id", studentId);

      if (profileError) {
        console.error("Profile update error:", profileError);
        // Don't throw error here as the main operation succeeded
      }

      toast({
        title: "เพิ่มนักศึกษาสำเร็จ",
        description: "เพิ่มนักศึกษาเข้ากลุ่มแล้ว",
      });

      // Reset selection
      setSelectedStudent("");

      if (user) await fetchData(user.id);
    } catch (error: any) {
      console.error("Error in handleAddStudentToGroup:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถเพิ่มนักศึกษาได้",
      });
    } finally {
      setIsAddingStudent(false);
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
                value="teachers"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                จัดการอาจารย์
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

            <TabsContent value="teachers" className="space-y-4 animate-in fade-in duration-300">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        จัดการบัญชีอาจารย์
                      </CardTitle>
                      <CardDescription>สร้างบัญชีและมอบหมายกลุ่มให้อาจารย์</CardDescription>
                    </div>
                    <Dialog open={isAddTeacherOpen} onOpenChange={setIsAddTeacherOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90">
                          <UserPlus className="w-4 h-4 mr-2" />
                          เพิ่มอาจารย์
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-background border shadow-lg">
                        <DialogHeader>
                          <DialogTitle>เพิ่มบัญชีอาจารย์</DialogTitle>
                          <DialogDescription>สร้างบัญชีใหม่สำหรับอาจารย์</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="teacher-email">อีเมล (@spu.ac.th) <span className="text-red-500">*</span></Label>
                            <Input
                              id="teacher-email"
                              type="email"
                              placeholder="teacher@spu.ac.th"
                              value={newTeacher.email}
                              onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                              className="bg-background"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="teacher-password">รหัสผ่าน <span className="text-red-500">*</span></Label>
                            <Input
                              id="teacher-password"
                              type="password"
                              value={newTeacher.password}
                              onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                              className="bg-background"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="teacher-firstName">ชื่อ <span className="text-red-500">*</span></Label>
                              <Input
                                id="teacher-firstName"
                                value={newTeacher.firstName}
                                onChange={(e) => setNewTeacher({ ...newTeacher, firstName: e.target.value })}
                                className="bg-background"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="teacher-lastName">นามสกุล <span className="text-red-500">*</span></Label>
                              <Input
                                id="teacher-lastName"
                                value={newTeacher.lastName}
                                onChange={(e) => setNewTeacher({ ...newTeacher, lastName: e.target.value })}
                                className="bg-background"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>กลุ่มที่รับผิดชอบ (เลือกได้หลายกลุ่ม)</Label>
                            <div className="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto bg-background">
                              {groups.map((group) => (
                                <div key={group.id} className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`group-${group.id}`}
                                    checked={newTeacher.groupIds.includes(group.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setNewTeacher({
                                          ...newTeacher,
                                          groupIds: [...newTeacher.groupIds, group.id],
                                        });
                                      } else {
                                        setNewTeacher({
                                          ...newTeacher,
                                          groupIds: newTeacher.groupIds.filter((id) => id !== group.id),
                                        });
                                      }
                                    }}
                                    className="rounded"
                                  />
                                  <Label htmlFor={`group-${group.id}`} className="font-normal cursor-pointer">
                                    {group.name} - {group.major} ปี {group.year_level}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAddTeacherOpen(false)} disabled={isSubmitting}>
                            ยกเลิก
                          </Button>
                          <Button onClick={handleAddTeacher} disabled={isSubmitting}>
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                กำลังสร้าง...
                              </>
                            ) : (
                              "สร้างบัญชี"
                            )}
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teachers.map((teacher: any) => {
                        const teacherGroups = teacherAssignments
                          .filter((ta: any) => ta.teacher_id === teacher.id)
                          .map((ta: any) => {
                            const group = groups.find((g) => g.id === ta.group_id);
                            return group ? `${group.name} (${group.major})` : "";
                          })
                          .filter(Boolean)
                          .join(", ");

                        return (
                          <TableRow key={teacher.id}>
                            <TableCell className="font-medium">
                              {teacher.first_name} {teacher.last_name}
                            </TableCell>
                            <TableCell>{teacher.email}</TableCell>
                            <TableCell>{teacherGroups || "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
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

                    {/* Edit Group Dialog */}
                    <Dialog open={isEditGroupOpen} onOpenChange={setIsEditGroupOpen}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>แก้ไขกลุ่ม</DialogTitle>
                          <DialogDescription>แก้ไขข้อมูลกลุ่มนักศึกษา</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="editGroupName">
                              ชื่อกลุ่ม <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="editGroupName"
                              placeholder="เช่น กลุ่ม 1, Section A"
                              value={editGroup.name}
                              onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="editMajor">
                              สาขา <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="editMajor"
                              placeholder="เช่น วิทยาการคอมพิวเตอร์"
                              value={editGroup.major}
                              onChange={(e) => setEditGroup({ ...editGroup, major: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="editYearLevel">
                              ชั้นปี <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="editYearLevel"
                              placeholder="เช่น 1, 2, 3, 4"
                              value={editGroup.yearLevel}
                              onChange={(e) => setEditGroup({ ...editGroup, yearLevel: e.target.value })}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditGroupOpen(false);
                              setEditingGroup(null);
                            }}
                            disabled={isSubmitting}
                          >
                            ยกเลิก
                          </Button>
                          <Button onClick={handleEditGroup} disabled={isSubmitting}>
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                กำลังบันทึก...
                              </>
                            ) : (
                              "บันทึกการเปลี่ยนแปลง"
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
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEditGroupDialog(group)}
                                        className="hover:bg-blue-50 hover:text-blue-600"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          strokeWidth={1.5}
                                          stroke="currentColor"
                                          className="w-4 h-4"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                                          />
                                        </svg>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>แก้ไขกลุ่ม</TooltipContent>
                                  </Tooltip>
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
                                      {/* Teachers Section - FIXED */}
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
                                        <div className="flex gap-2">
                                          <Select
                                            value={selectedGroup === group.id ? selectedTeacher : ""}
                                            onValueChange={setSelectedTeacher}
                                          >
                                            <SelectTrigger className="w-full md:w-[300px]">
                                              <SelectValue placeholder="เลือกอาจารย์" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {teachers
                                                .filter(
                                                  (t) =>
                                                    !teacherAssignments.some(
                                                      (a) => a.teacher_id === t.id && a.group_id === group.id,
                                                    ),
                                                )
                                                .map((t) => (
                                                  <SelectItem key={t.id} value={t.id}>
                                                    {t.first_name} {t.last_name} {t.employee_id && `(${t.employee_id})`}
                                                  </SelectItem>
                                                ))}
                                            </SelectContent>
                                          </Select>
                                          <Button
                                            onClick={() => {
                                              if (selectedTeacher) {
                                                handleAssignTeacher(group.id, selectedTeacher);
                                              }
                                            }}
                                            disabled={isAssigningTeacher || !selectedTeacher}
                                            size="sm"
                                          >
                                            {isAssigningTeacher ? (
                                              <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                              "เพิ่ม"
                                            )}
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Students Section - FIXED */}
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
                                                {member.profiles?.first_name} {member.profiles?.last_name}
                                                {member.profiles?.student_id && ` (${member.profiles.student_id})`}
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
                                        <div className="flex gap-2">
                                          <Select
                                            value={selectedGroup === group.id ? selectedStudent : ""}
                                            onValueChange={setSelectedStudent}
                                          >
                                            <SelectTrigger className="w-full md:w-[300px]">
                                              <SelectValue placeholder="เลือกนักศึกษา" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {students
                                                .filter(
                                                  (s) =>
                                                    // Exclude students already in ANY group
                                                    !groupMembers.some((m) => m.student_id === s.id),
                                                )
                                                .map((s) => (
                                                  <SelectItem key={s.id} value={s.id}>
                                                    {s.first_name} {s.last_name} {s.student_id && `(${s.student_id})`}
                                                  </SelectItem>
                                                ))}
                                            </SelectContent>
                                          </Select>
                                          <Button
                                            onClick={() => {
                                              if (selectedStudent) {
                                                handleAddStudentToGroup(group.id, selectedStudent);
                                              }
                                            }}
                                            disabled={isAddingStudent || !selectedStudent}
                                            size="sm"
                                          >
                                            {isAddingStudent ? <Loader2 className="w-4 h-4 animate-spin" /> : "เพิ่ม"}
                                          </Button>
                                        </div>
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
