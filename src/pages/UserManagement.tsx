import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus } from "lucide-react";

const UserManagement = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "teacher",
    employee_id: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roles?.role !== "super_admin") {
        navigate("/");
        return;
      }

      setUser(user);
    } catch (error) {
      console.error("Error checking auth:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // สร้าง user ใหม่
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.first_name,
            last_name: formData.last_name,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // เพิ่ม role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert([{
            user_id: authData.user.id,
            role: formData.role as any,
          }]);

        if (roleError) throw roleError;

        // อัพเดท profile
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            employee_id: formData.employee_id,
          })
          .eq("id", authData.user.id);

        if (profileError) throw profileError;

        toast({
          title: "สำเร็จ",
          description: "เพิ่มผู้ใช้งานใหม่แล้ว",
        });

        setFormData({
          email: "",
          password: "",
          first_name: "",
          last_name: "",
          role: "teacher",
          employee_id: "",
        });
      }
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

  useEffect(() => {
    if (user) {
      fetchUsersAndGroups();
    }
  }, [user]);

  const fetchUsersAndGroups = async () => {
    try {
      setLoadingUsers(true);
      const [usersRes, groupsRes] = await Promise.all([
        supabase.from("profiles").select("id, email, first_name, last_name, employee_id, user_roles (role)").order("first_name"),
        supabase.from("student_groups").select("*").order("name"),
      ]);
      setUsers(usersRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "โหลดข้อมูลไม่สำเร็จ", description: error.message });
    } finally {
      setLoadingUsers(false);
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase.from("user_roles").update({ role: role as any }).eq("user_id", userId);
      if (error) throw error;
      toast({ title: "อัปเดตบทบาทสำเร็จ" });
      fetchUsersAndGroups();
    } catch (error: any) {
      toast({ variant: "destructive", title: "อัปเดตบทบาทไม่สำเร็จ", description: error.message });
    }
  };

  const openAssignDialog = async (u: any) => {
    try {
      setSelectedTeacherId(u.id);
      setSelectedTeacherName(`${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email);
      // Prefetch assignments
      const { data, error } = await supabase
        .from("teacher_assignments")
        .select("group_id")
        .eq("teacher_id", u.id);
      if (error) throw error;
      setSelectedGroupIds((data || []).map((d: any) => d.group_id));
      setAssignDialogOpen(true);
    } catch (error: any) {
      toast({ variant: "destructive", title: "โหลดข้อมูลกลุ่มไม่สำเร็จ", description: error.message });
    }
  };

  const toggleGroupSelection = (groupId: string, checked: boolean | string) => {
    setSelectedGroupIds((prev) => {
      const isChecked = checked === true || checked === "indeterminate"; // treat string truthy as checked
      if (isChecked) {
        return prev.includes(groupId) ? prev : [...prev, groupId];
      }
      return prev.filter((id) => id !== groupId);
    });
  };

  const saveTeacherAssignments = async () => {
    if (!selectedTeacherId) return;
    setIsSavingAssignments(true);
    try {
      // Clear existing
      const { error: delErr } = await supabase
        .from("teacher_assignments")
        .delete()
        .eq("teacher_id", selectedTeacherId);
      if (delErr) throw delErr;

      if (selectedGroupIds.length > 0) {
        const rows = selectedGroupIds.map((gid) => ({ teacher_id: selectedTeacherId, group_id: gid }));
        const { error: insErr } = await supabase.from("teacher_assignments").insert(rows);
        if (insErr) throw insErr;
      }

      toast({ title: "บันทึกการมอบหมายอาจารย์สำเร็จ" });
      setAssignDialogOpen(false);
      fetchUsersAndGroups();
    } catch (error: any) {
      toast({ variant: "destructive", title: "บันทึกไม่สำเร็จ", description: error.message });
    } finally {
      setIsSavingAssignments(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <DashboardLayout role="super_admin" userName="Super Admin">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              จัดการผู้ใช้งาน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="create">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">เพิ่มอาจารย์/Staff</TabsTrigger>
                <TabsTrigger value="manage">จัดการผู้ใช้</TabsTrigger>
              </TabsList>

              <TabsContent value="create">
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>ชื่อ</Label>
                      <Input
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>นามสกุล</Label>
                      <Input
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label>อีเมล (@spu.ac.th)</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="example@spu.ac.th"
                      required
                    />
                  </div>

                  <div>
                    <Label>รหัสพนักงาน</Label>
                    <Input
                      value={formData.employee_id}
                      onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>รหัสผ่าน</Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>

                  <div>
                    <Label>บทบาท</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="teacher">อาจารย์</SelectItem>
                        <SelectItem value="admin">Admin/Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    เพิ่มผู้ใช้งาน
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="manage">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="ค้นหาชื่อหรืออีเมล..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {loadingUsers ? (
                    <div className="py-6 text-center text-muted-foreground">กำลังโหลด...</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ชื่อ</TableHead>
                            <TableHead>อีเมล</TableHead>
                            <TableHead>บทบาท</TableHead>
                            <TableHead className="w-40">การจัดการ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users
                            .filter((u) => {
                              const q = searchTerm.toLowerCase();
                              return (
                                !q ||
                                `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase().includes(q) ||
                                (u.email || "").toLowerCase().includes(q)
                              );
                            })
                            .map((u) => {
                              const role = u.user_roles?.[0]?.role || "";
                              const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
                              return (
                                <TableRow key={u.id}>
                                  <TableCell className="font-medium">{fullName || "-"}</TableCell>
                                  <TableCell>{u.email}</TableCell>
                                  <TableCell>
                                    <Select value={role} onValueChange={(val) => updateUserRole(u.id, val)}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="เลือกบทบาท" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="teacher">อาจารย์</SelectItem>
                                        <SelectItem value="admin">Admin/Staff</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    {role === "teacher" ? (
                                      <Button size="sm" onClick={() => openAssignDialog(u)} className="w-full">จัดการกลุ่ม</Button>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>มอบหมายกลุ่มให้: {selectedTeacherName}</DialogTitle>
                      </DialogHeader>
                      <div className="max-h-80 overflow-y-auto space-y-2 mt-2">
                        {groups.map((g) => (
                          <label key={g.id} className="flex items-center gap-3 py-1">
                            <Checkbox
                              checked={selectedGroupIds.includes(g.id)}
                              onCheckedChange={(c) => toggleGroupSelection(g.id, c)}
                            />
                            <span>{g.name} • {g.major} • ปี {g.year_level}</span>
                          </label>
                        ))}
                      </div>
                      <DialogFooter>
                        <Button variant="secondary" onClick={() => setAssignDialogOpen(false)}>ยกเลิก</Button>
                        <Button onClick={saveTeacherAssignments} disabled={isSavingAssignments}>
                          {isSavingAssignments ? "กำลังบันทึก..." : "บันทึก"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UserManagement;
