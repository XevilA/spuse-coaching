import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, FileCheck, Settings, UserPlus, Trash2, Download, Edit, Lock, Unlock, MessageCircle, Upload, UserCog } from "lucide-react";
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
import * as XLSX from "xlsx";
import { Checkbox } from "@/components/ui/checkbox";
import { AutomationSettings } from "@/components/AutomationSettings";

export default function SuperAdmin() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [lineChannels, setLineChannels] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [lineChannelAssignments, setLineChannelAssignments] = useState<any[]>([]);
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog states
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isAddLineChannelOpen, setIsAddLineChannelOpen] = useState(false);
  const [isEditLineChannelOpen, setIsEditLineChannelOpen] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isEditTeacherOpen, setIsEditTeacherOpen] = useState(false);
  const [isAssignLineChannelOpen, setIsAssignLineChannelOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [isImportStudentOpen, setIsImportStudentOpen] = useState(false);
  const [isManageGroupMembersOpen, setIsManageGroupMembersOpen] = useState(false);
  
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

  const [newLineAssignment, setNewLineAssignment] = useState({
    teacherId: "",
    lineChannelIds: [] as string[],
  });

  const [newStudent, setNewStudent] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    studentId: "",
    yearLevel: "",
    major: "",
    groupId: "",
  });

  const [editStudent, setEditStudent] = useState({
    firstName: "",
    lastName: "",
    studentId: "",
    yearLevel: "",
    major: "",
    groupId: "",
  });

  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<any>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const verifyRole = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      navigate('/auth');
      return false;
    }
    
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id)
      .single();
    
    if (roleData?.role !== 'super_admin') {
      toast({
        variant: "destructive",
        title: "ไม่มีสิทธิ์เข้าถึง",
        description: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้",
      });
      navigate('/auth');
      return false;
    }
    return true;
  };

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
      .on("postgres_changes", { event: "*", schema: "public", table: "line_channel_assignments" }, () => {
        if (user?.id) fetchData(user.id);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkAuth = async () => {
    const isAuthorized = await verifyRole();
    if (!isAuthorized) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    fetchData(session.user.id);
  };

  const fetchData = async (userId: string) => {
    try {
      const [profileRes, usersRes, groupsRes, sessionsRes, lineChannelsRes, assignmentsRes, membersRes, lineAssignmentsRes, logsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("profiles").select("*, user_roles(role)"),
        supabase.from("student_groups").select("*"),
        supabase.from("coaching_sessions").select("*, profiles!coaching_sessions_student_id_fkey(group_id)"),
        supabase.from("line_notifications").select("*").order("name"),
        supabase.from("teacher_assignments").select("*, profiles!teacher_assignments_teacher_id_fkey(first_name, last_name), student_groups(name)"),
        supabase.from("group_members").select("*, profiles!group_members_student_id_fkey(first_name, last_name, student_id)"),
        supabase.from("line_channel_assignments").select(`
          *,
          profiles!line_channel_assignments_teacher_id_fkey(first_name, last_name, email),
          line_notifications!line_channel_assignments_line_notification_id_fkey(name)
        `),
        supabase.from("automation_logs").select("*, profiles!automation_logs_recipient_id_fkey(first_name, last_name, email)").order("created_at", { ascending: false }).limit(100),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (usersRes.data) setUsers(usersRes.data);
      if (groupsRes.data) setGroups(groupsRes.data);
      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (lineChannelsRes.data) setLineChannels(lineChannelsRes.data);
      if (assignmentsRes.data) setTeacherAssignments(assignmentsRes.data);
      if (membersRes.data) setGroupMembers(membersRes.data);
      if (lineAssignmentsRes.data) setLineChannelAssignments(lineAssignmentsRes.data);
      if (logsRes.data) setAutomationLogs(logsRes.data);
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
      // Create user using admin API with auto-confirmation
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newTeacher.email,
        password: newTeacher.password,
        email_confirm: true,
        user_metadata: {
          first_name: newTeacher.firstName,
          last_name: newTeacher.lastName,
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("ไม่สามารถสร้างผู้ใช้ได้");

      // Profile should be created by trigger, just update it
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: newTeacher.firstName,
          last_name: newTeacher.lastName,
        })
        .eq("id", authData.user.id);

      if (profileError) console.error("Profile update warning:", profileError);

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

  // LINE Channel Assignment Management
  const handleAssignLineChannel = async () => {
    if (!newLineAssignment.teacherId) {
      toast({ variant: "destructive", title: "กรุณาเลือกอาจารย์" });
      return;
    }

    if (newLineAssignment.lineChannelIds.length === 0) {
      toast({ variant: "destructive", title: "กรุณาเลือก LINE Channel อย่างน้อย 1 Channel" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Remove existing assignments for this teacher
      await supabase
        .from("line_channel_assignments")
        .delete()
        .eq("teacher_id", newLineAssignment.teacherId);

      // Insert new assignments
      const assignments = newLineAssignment.lineChannelIds.map((channelId) => ({
        teacher_id: newLineAssignment.teacherId,
        line_notification_id: channelId,
      }));

      const { error } = await supabase.from("line_channel_assignments").insert(assignments);

      if (error) throw error;

      toast({
        title: "บันทึกสำเร็จ",
        description: `มอบหมาย LINE Channel ให้อาจารย์เรียบร้อยแล้ว`,
      });
      setIsAssignLineChannelOpen(false);
      setNewLineAssignment({ teacherId: "", lineChannelIds: [] });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถมอบหมาย LINE Channel ได้",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAllLineChannels = async (teacherId: string, teacherName: string) => {
    if (!confirm(`ต้องการลบ LINE Channel ทั้งหมดของ ${teacherName} หรือไม่?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("line_channel_assignments")
        .delete()
        .eq("teacher_id", teacherId);

      if (error) throw error;

      toast({
        title: "ลบสำเร็จ",
        description: `ลบ LINE Channel ของ ${teacherName} แล้ว`,
      });
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถลบได้",
        description: error.message,
      });
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
      } else if (itemToDelete.type === "student") {
        const { error: memberError } = await supabase.from("group_members").delete().eq("student_id", itemToDelete.id);
        if (memberError) throw memberError;

        const { error: deleteError } = await supabase.auth.admin.deleteUser(itemToDelete.id);
        if (deleteError) throw deleteError;
        toast({ title: "ลบนักศึกษาสำเร็จ" });
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

  // Student Management
  const handleAddStudent = async () => {
    if (!newStudent.email || !newStudent.password || !newStudent.firstName || !newStudent.lastName) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }

    if (!newStudent.email.endsWith("@spumail.net")) {
      toast({ variant: "destructive", title: "อีเมลต้องเป็นโดเมน @spumail.net เท่านั้น" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create user using admin API with auto-confirmation
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newStudent.email,
        password: newStudent.password,
        email_confirm: true,
        user_metadata: {
          first_name: newStudent.firstName,
          last_name: newStudent.lastName,
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("ไม่สามารถสร้างผู้ใช้ได้");

      // Profile should be created by trigger, just update it
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: newStudent.firstName,
          last_name: newStudent.lastName,
          student_id: newStudent.studentId || null,
          year_level: newStudent.yearLevel || null,
          major: newStudent.major || null,
        })
        .eq("id", authData.user.id);

      if (profileError) console.error("Profile update warning:", profileError);

      if (newStudent.groupId) {
        const { error: memberError } = await supabase.from("group_members").insert({
          group_id: newStudent.groupId,
          student_id: authData.user.id,
          is_leader: false,
        });
        if (memberError) throw memberError;
      }

      toast({ title: "สร้างบัญชีสำเร็จ", description: `สร้างบัญชีนักศึกษา ${newStudent.email} เรียบร้อยแล้ว` });
      setNewStudent({ email: "", password: "", firstName: "", lastName: "", studentId: "", yearLevel: "", major: "", groupId: "" });
      setIsAddStudentOpen(false);
      if (user) fetchData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditStudentDialog = (student: any) => {
    setEditingStudent(student);
    const studentGroup = groupMembers.find((gm: any) => gm.student_id === student.id);
    setEditStudent({
      firstName: student.first_name,
      lastName: student.last_name,
      studentId: student.student_id || "",
      yearLevel: student.year_level || "",
      major: student.major || "",
      groupId: studentGroup?.group_id || "",
    });
    setIsEditStudentOpen(true);
  };

  const handleEditStudentSubmit = async () => {
    if (!editStudent.firstName || !editStudent.lastName || !editingStudent) {
      toast({ variant: "destructive", title: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: editStudent.firstName.trim(),
          last_name: editStudent.lastName.trim(),
          student_id: editStudent.studentId || null,
          year_level: editStudent.yearLevel || null,
          major: editStudent.major || null,
        })
        .eq("id", editingStudent.id);

      if (profileError) throw profileError;

      // Update group membership
      await supabase.from("group_members").delete().eq("student_id", editingStudent.id);

      if (editStudent.groupId) {
        const { error: memberError } = await supabase.from("group_members").insert({
          group_id: editStudent.groupId,
          student_id: editingStudent.id,
          is_leader: false,
        });
        if (memberError) throw memberError;
      }

      toast({ title: "แก้ไขสำเร็จ" });
      setIsEditStudentOpen(false);
      setEditingStudent(null);
      setEditStudent({ firstName: "", lastName: "", studentId: "", yearLevel: "", major: "", groupId: "" });
      await fetchData(user.id);
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = (studentId: string, studentName: string) => {
    setItemToDelete({ type: "student", id: studentId, name: studentName });
    setDeleteConfirmOpen(true);
  };

  const handleImportStudents = async () => {
    if (!importFile) {
      toast({ variant: "destructive", title: "กรุณาเลือกไฟล์" });
      return;
    }

    setIsSubmitting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

          let successCount = 0;
          let errorCount = 0;

          for (const row of jsonData) {
            try {
              const email = row["อีเมล"] || row["email"];
              const password = row["รหัสผ่าน"] || row["password"] || "changeme123";
              const firstName = row["ชื่อ"] || row["first_name"];
              const lastName = row["นามสกุล"] || row["last_name"];
              const studentId = row["รหัสนักศึกษา"] || row["student_id"];
              const yearLevel = row["ชั้นปี"] || row["year_level"];
              const major = row["สาขา"] || row["major"];
              const groupName = row["กลุ่ม"] || row["group_name"];

              if (!email || !firstName || !lastName) {
                errorCount++;
                continue;
              }

              const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                  data: { first_name: firstName, last_name: lastName },
                  emailRedirectTo: `${window.location.origin}/`,
                },
              });

              if (authError) {
                errorCount++;
                continue;
              }

              if (authData.user) {
                await supabase
                  .from("profiles")
                  .update({
                    first_name: firstName,
                    last_name: lastName,
                    student_id: studentId || null,
                    year_level: yearLevel || null,
                    major: major || null,
                  })
                  .eq("id", authData.user.id);

                if (groupName) {
                  const group = groups.find((g) => g.name === groupName);
                  if (group) {
                    await supabase.from("group_members").insert({
                      group_id: group.id,
                      student_id: authData.user.id,
                      is_leader: false,
                    });
                  }
                }
              }

              successCount++;
            } catch (err) {
              errorCount++;
            }
          }

          toast({
            title: "นำเข้าข้อมูลเสร็จสิ้น",
            description: `สำเร็จ: ${successCount} คน, ไม่สำเร็จ: ${errorCount} คน`,
          });

          setIsImportStudentOpen(false);
          setImportFile(null);
          if (user) fetchData(user.id);
        } catch (error: any) {
          toast({ variant: "destructive", title: "เกิดข้อผิดพลาดในการอ่านไฟล์", description: error.message });
        } finally {
          setIsSubmitting(false);
        }
      };

      reader.readAsArrayBuffer(importFile);
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
      setIsSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        "อีเมล": "student@spumail.net",
        "รหัสผ่าน": "changeme123",
        "ชื่อ": "สมชาย",
        "นามสกุล": "ใจดี",
        "รหัสนักศึกษา": "65123456",
        "ชั้นปี": "3",
        "สาขา": "วิทยาการคอมพิวเตอร์",
        "กลุ่ม": "ชื่อกลุ่ม (ถ้ามี)",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "student_import_template.xlsx");
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
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">นักศึกษา</CardTitle>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="อัปเดตแบบ Realtime" />
              </div>
              <Users className="w-5 h-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{students.length}</div>
              <p className="text-xs text-muted-foreground mt-1">อัปเดตแบบ Realtime</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">อาจารย์</CardTitle>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="อัปเดตแบบ Realtime" />
              </div>
              <Shield className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{teachers.length}</div>
              <p className="text-xs text-muted-foreground mt-1">อัปเดตแบบ Realtime</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">ผู้ดูแลระบบ</CardTitle>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="อัปเดตแบบ Realtime" />
              </div>
              <Shield className="w-5 h-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{admins.length}</div>
              <p className="text-xs text-muted-foreground mt-1">อัปเดตแบบ Realtime</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">ใบ Coaching</CardTitle>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="อัปเดตแบบ Realtime" />
              </div>
              <FileCheck className="w-5 h-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{sessions.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {sessions.filter((s) => s.status === "pending").length} รอตรวจสอบ • Realtime
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="teachers" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="teachers">จัดการอาจารย์</TabsTrigger>
            <TabsTrigger value="students">จัดการนักศึกษา</TabsTrigger>
            <TabsTrigger value="groups">จัดการกลุ่ม</TabsTrigger>
            <TabsTrigger value="line">LINE Broadcast</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
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

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>จัดการนักศึกษา</CardTitle>
                    <CardDescription>เพิ่ม แก้ไข ลบ หรือ import นักศึกษาจาก Excel/CSV</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={isImportStudentOpen} onOpenChange={setIsImportStudentOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Upload className="w-4 h-4 mr-2" />
                          Import Excel/CSV
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>นำเข้านักศึกษาจากไฟล์</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Alert>
                            <AlertDescription>
                              ไฟล์ต้องมีคอลัมน์: อีเมล, รหัสผ่าน (optional), ชื่อ, นามสกุล, รหัสนักศึกษา, ชั้นปี, สาขา, กลุ่ม
                            </AlertDescription>
                          </Alert>
                          <div>
                            <Label htmlFor="import-file">เลือกไฟล์ Excel หรือ CSV</Label>
                            <Input
                              id="import-file"
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            />
                          </div>
                          <Button variant="outline" onClick={downloadTemplate}>
                            <Download className="w-4 h-4 mr-2" />
                            ดาวน์โหลด Template
                          </Button>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleImportStudents} disabled={isSubmitting || !importFile}>
                            {isSubmitting ? "กำลังนำเข้า..." : "นำเข้าข้อมูล"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="w-4 h-4 mr-2" />
                          เพิ่มนักศึกษา
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>เพิ่มนักศึกษาใหม่</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="student-email">อีเมล (@spumail.net)</Label>
                            <Input
                              id="student-email"
                              type="email"
                              value={newStudent.email}
                              onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                              placeholder="example@spumail.net"
                            />
                          </div>
                          <div>
                            <Label htmlFor="student-password">รหัสผ่าน</Label>
                            <Input
                              id="student-password"
                              type="password"
                              value={newStudent.password}
                              onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="student-firstname">ชื่อ</Label>
                            <Input
                              id="student-firstname"
                              value={newStudent.firstName}
                              onChange={(e) => setNewStudent({ ...newStudent, firstName: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="student-lastname">นามสกุล</Label>
                            <Input
                              id="student-lastname"
                              value={newStudent.lastName}
                              onChange={(e) => setNewStudent({ ...newStudent, lastName: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="student-id">รหัสนักศึกษา</Label>
                            <Input
                              id="student-id"
                              value={newStudent.studentId}
                              onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="student-year">ชั้นปี</Label>
                            <Input
                              id="student-year"
                              value={newStudent.yearLevel}
                              onChange={(e) => setNewStudent({ ...newStudent, yearLevel: e.target.value })}
                              placeholder="เช่น 1, 2, 3, 4"
                            />
                          </div>
                          <div>
                            <Label htmlFor="student-major">สาขาวิชา</Label>
                            <Input
                              id="student-major"
                              value={newStudent.major}
                              onChange={(e) => setNewStudent({ ...newStudent, major: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>กลุ่ม (ถ้ามี)</Label>
                            <Select
                              value={newStudent.groupId}
                              onValueChange={(value) => setNewStudent({ ...newStudent, groupId: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="เลือกกลุ่ม" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">ไม่มีกลุ่ม</SelectItem>
                                {groups.map((group) => (
                                  <SelectItem key={group.id} value={group.id}>
                                    {group.name} - {group.major} ปี {group.year_level}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddStudent} disabled={isSubmitting}>
                            {isSubmitting ? "กำลังเพิ่ม..." : "เพิ่มนักศึกษา"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อ-นามสกุล</TableHead>
                      <TableHead>อีเมล</TableHead>
                      <TableHead>รหัสนักศึกษา</TableHead>
                      <TableHead>ชั้นปี</TableHead>
                      <TableHead>สาขา</TableHead>
                      <TableHead>กลุ่ม</TableHead>
                      <TableHead>จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          ไม่มีนักศึกษาในระบบ
                        </TableCell>
                      </TableRow>
                    ) : (
                      students.map((student) => {
                        const studentGroup = groupMembers.find((gm: any) => gm.student_id === student.id);
                        const group = groups.find((g) => g.id === studentGroup?.group_id);
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">
                              {student.first_name} {student.last_name}
                            </TableCell>
                            <TableCell>{student.email}</TableCell>
                            <TableCell>{student.student_id || "-"}</TableCell>
                            <TableCell>{student.year_level || "-"}</TableCell>
                            <TableCell>{student.major || "-"}</TableCell>
                            <TableCell>
                              {group ? (
                                <Badge variant="outline">{group.name}</Badge>
                              ) : (
                                <span className="text-muted-foreground">ไม่มีกลุ่ม</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditStudentDialog(student)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteStudent(student.id, `${student.first_name} ${student.last_name}`)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Edit Student Dialog */}
            <Dialog open={isEditStudentOpen} onOpenChange={setIsEditStudentOpen}>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>แก้ไขข้อมูลนักศึกษา</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-student-firstname">ชื่อ</Label>
                    <Input
                      id="edit-student-firstname"
                      value={editStudent.firstName}
                      onChange={(e) => setEditStudent({ ...editStudent, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-student-lastname">นามสกุล</Label>
                    <Input
                      id="edit-student-lastname"
                      value={editStudent.lastName}
                      onChange={(e) => setEditStudent({ ...editStudent, lastName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-student-id">รหัสนักศึกษา</Label>
                    <Input
                      id="edit-student-id"
                      value={editStudent.studentId}
                      onChange={(e) => setEditStudent({ ...editStudent, studentId: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-student-year">ชั้นปี</Label>
                    <Input
                      id="edit-student-year"
                      value={editStudent.yearLevel}
                      onChange={(e) => setEditStudent({ ...editStudent, yearLevel: e.target.value })}
                      placeholder="เช่น 1, 2, 3, 4"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-student-major">สาขาวิชา</Label>
                    <Input
                      id="edit-student-major"
                      value={editStudent.major}
                      onChange={(e) => setEditStudent({ ...editStudent, major: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>กลุ่ม</Label>
                    <Select
                      value={editStudent.groupId}
                      onValueChange={(value) => setEditStudent({ ...editStudent, groupId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกกลุ่ม" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">ไม่มีกลุ่ม</SelectItem>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name} - {group.major} ปี {group.year_level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleEditStudentSubmit} disabled={isSubmitting}>
                    {isSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="channel-student-group">เลือกกลุ่มนักศึกษา (ถ้าต้องการ)</Label>
                              <Select
                                value={newLineChannel.groupId}
                                onValueChange={(value) => setNewLineChannel({ ...newLineChannel, groupId: value })}
                              >
                                <SelectTrigger id="channel-student-group">
                                  <SelectValue placeholder="เลือกกลุ่มนักศึกษา หรือพิมพ์ LINE Group ID ด้านล่าง" />
                                </SelectTrigger>
                                <SelectContent>
                                  {groups.map((group) => (
                                    <SelectItem key={group.id} value={group.id}>
                                      {group.name} - {group.major} ({group.year_level})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-sm text-muted-foreground mt-1">
                                เลือกกลุ่มนักศึกษาในระบบ หรือพิมพ์ LINE Group ID ด้านล่าง
                              </p>
                            </div>
                            <div>
                              <Label htmlFor="channel-group-id">หรือ พิมพ์ LINE Group ID</Label>
                              <Input
                                id="channel-group-id"
                                value={newLineChannel.groupId}
                                onChange={(e) => setNewLineChannel({ ...newLineChannel, groupId: e.target.value })}
                                placeholder="เช่น: C1234567890abcdef1234567890abcdef"
                              />
                              <p className="text-sm text-muted-foreground mt-1">
                                Group ID จาก LINE (เริ่มด้วย C)
                              </p>
                            </div>
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

            {/* LINE Channel Assignments */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>มอบหมาย LINE Channel ให้อาจารย์</CardTitle>
                    <CardDescription>กำหนด Channel ที่อาจารย์แต่ละคนสามารถใช้ส่งข้อความได้</CardDescription>
                  </div>
                  <Dialog open={isAssignLineChannelOpen} onOpenChange={setIsAssignLineChannelOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="w-4 h-4 mr-2" />
                        มอบหมาย Channel
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>มอบหมาย LINE Channel ให้อาจารย์</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="assign-teacher">เลือกอาจารย์</Label>
                          <Select
                            value={newLineAssignment.teacherId}
                            onValueChange={(value) => setNewLineAssignment({ ...newLineAssignment, teacherId: value })}
                          >
                            <SelectTrigger id="assign-teacher">
                              <SelectValue placeholder="เลือกอาจารย์" />
                            </SelectTrigger>
                            <SelectContent>
                              {teachers.map((teacher) => (
                                <SelectItem key={teacher.id} value={teacher.id}>
                                  {teacher.first_name} {teacher.last_name} ({teacher.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>เลือก LINE Channel</Label>
                          <div className="space-y-2 mt-2 max-h-60 overflow-y-auto border rounded-md p-3">
                            {lineChannels.filter(c => c.enabled).map((channel) => (
                              <div key={channel.id} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`channel-${channel.id}`}
                                  checked={newLineAssignment.lineChannelIds.includes(channel.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewLineAssignment({
                                        ...newLineAssignment,
                                        lineChannelIds: [...newLineAssignment.lineChannelIds, channel.id],
                                      });
                                    } else {
                                      setNewLineAssignment({
                                        ...newLineAssignment,
                                        lineChannelIds: newLineAssignment.lineChannelIds.filter(id => id !== channel.id),
                                      });
                                    }
                                  }}
                                  className="rounded"
                                />
                                <label htmlFor={`channel-${channel.id}`} className="text-sm cursor-pointer flex-1">
                                  <div className="font-medium">{channel.name}</div>
                                  {channel.description && (
                                    <div className="text-xs text-muted-foreground">{channel.description}</div>
                                  )}
                                </label>
                              </div>
                            ))}
                          </div>
                          {newLineAssignment.lineChannelIds.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {newLineAssignment.lineChannelIds.map(id => {
                                const channel = lineChannels.find(c => c.id === id);
                                return channel ? (
                                  <Badge key={id} variant="secondary">
                                    {channel.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAssignLineChannel} disabled={isSubmitting}>
                          {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
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
                      <TableHead>อาจารย์</TableHead>
                      <TableHead>อีเมล</TableHead>
                      <TableHead>LINE Channels ที่ได้รับมอบหมาย</TableHead>
                      <TableHead>จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          ยังไม่มีอาจารย์ในระบบ
                        </TableCell>
                      </TableRow>
                    ) : (
                      teachers.map((teacher) => {
                        const teacherChannels = lineChannelAssignments.filter(
                          (assignment: any) => assignment.teacher_id === teacher.id
                        );
                        return (
                          <TableRow key={teacher.id}>
                            <TableCell className="font-medium">
                              {teacher.first_name} {teacher.last_name}
                            </TableCell>
                            <TableCell>{teacher.email}</TableCell>
                            <TableCell>
                              {teacherChannels.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {teacherChannels.map((assignment: any) => (
                                    <Badge key={assignment.id} variant="outline">
                                      {assignment.line_notifications?.name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">ยังไม่มี Channel</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setNewLineAssignment({
                                      teacherId: teacher.id,
                                      lineChannelIds: teacherChannels.map((a: any) => a.line_notification_id),
                                    });
                                    setIsAssignLineChannelOpen(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                {teacherChannels.length > 0 && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleRemoveAllLineChannels(teacher.id, `${teacher.first_name} ${teacher.last_name}`)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Automation Tab */}
          <TabsContent value="automation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Automation Logs</CardTitle>
                <CardDescription>ประวัติการส่งการแจ้งเตือนอัตโนมัติ</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เวลา</TableHead>
                      <TableHead>เหตุการณ์</TableHead>
                      <TableHead>ช่องทาง</TableHead>
                      <TableHead>ผู้รับ</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>รายละเอียด</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {automationLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          ยังไม่มีการแจ้งเตือนอัตโนมัติ
                        </TableCell>
                      </TableRow>
                    ) : (
                      automationLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {new Date(log.created_at).toLocaleString('th-TH')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {log.event_type === 'coaching_submitted' && '📝 ส่งใบ Coaching'}
                              {log.event_type === 'coaching_reviewed' && '✅ ตรวจใบ Coaching'}
                              {log.event_type === 'appointment_booked' && '📅 นัดหมาย'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.notification_type === 'line' ? 'default' : 'secondary'}>
                              {log.notification_type === 'line' && '💬 LINE'}
                              {log.notification_type === 'email' && '📧 Email'}
                              {log.notification_type === 'both' && '💬📧 ทั้งสอง'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.profiles?.first_name} {log.profiles?.last_name}
                            <div className="text-xs text-muted-foreground">{log.profiles?.email}</div>
                          </TableCell>
                          <TableCell>
                            {log.status === 'sent' && <Badge className="bg-green-500">ส่งแล้ว</Badge>}
                            {log.status === 'pending' && <Badge variant="secondary">รอส่ง</Badge>}
                            {log.status === 'failed' && <Badge variant="destructive">ล้มเหลว</Badge>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {log.metadata?.group_name && `กลุ่ม: ${log.metadata.group_name}`}
                            {log.metadata?.session_number && ` | ครั้งที่: ${log.metadata.session_number}`}
                            {log.error_message && (
                              <div className="text-red-500 text-xs mt-1">{log.error_message}</div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Alert>
              <AlertDescription>
                <strong>วิธีใช้งาน Automation:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>อาจารย์สามารถตั้งค่าการแจ้งเตือนได้ที่หน้า Teacher Dashboard</li>
                  <li>ระบบจะส่งการแจ้งเตือนอัตโนมัติเมื่อมีเหตุการณ์ที่กำหนดไว้</li>
                  <li>สามารถเลือกรับแจ้งเตือนผ่าน LINE หรือ Email</li>
                  <li>ต้องมอบหมาย LINE Channel ให้อาจารย์ก่อนที่จะสามารถรับแจ้งเตือนผ่าน LINE ได้</li>
                </ul>
              </AlertDescription>
            </Alert>
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
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-channel-student-group">เลือกกลุ่มนักศึกษา (ถ้าต้องการ)</Label>
                    <Select
                      value={editLineChannel.groupId}
                      onValueChange={(value) => setEditLineChannel({ ...editLineChannel, groupId: value })}
                    >
                      <SelectTrigger id="edit-channel-student-group">
                        <SelectValue placeholder="เลือกกลุ่มนักศึกษา หรือพิมพ์ LINE Group ID ด้านล่าง" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name} - {group.major} ({group.year_level})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">
                      เลือกกลุ่มนักศึกษาในระบบ หรือพิมพ์ LINE Group ID ด้านล่าง
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="edit-channel-group-id">หรือ พิมพ์ LINE Group ID</Label>
                    <Input
                      id="edit-channel-group-id"
                      value={editLineChannel.groupId}
                      onChange={(e) => setEditLineChannel({ ...editLineChannel, groupId: e.target.value })}
                      placeholder="เช่น: C1234567890abcdef1234567890abcdef"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Group ID จาก LINE (เริ่มด้วย C)
                    </p>
                  </div>
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