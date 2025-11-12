import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SmartStudentSearch } from "./SmartStudentSearch";
import { Users, UserPlus, UserMinus, Crown, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { studentGroupSchema } from "@/lib/validations";

interface Student {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  student_id: string | null;
}

interface Group {
  id: string;
  name: string;
  major: string;
  year_level: string;
}

interface GroupMember {
  id: string;
  student_id: string;
  is_leader: boolean;
  profiles: Student;
}

interface StudentGroupSelectorProps {
  userId: string;
  currentGroupId?: string;
  onGroupChange: () => void;
}

export function StudentGroupSelector({ userId, currentGroupId, onGroupChange }: StudentGroupSelectorProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>(currentGroupId || "");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // New group creation
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMajor, setNewGroupMajor] = useState("");
  const [newGroupYear, setNewGroupYear] = useState("");

  useEffect(() => {
    fetchGroups();
    if (currentGroupId) {
      checkLeaderStatus();
      fetchGroupMembers();
    }
  }, [currentGroupId]);

  const fetchGroups = async () => {
    const { data } = await supabase
      .from("student_groups")
      .select("*")
      .order("name");
    
    if (data) setGroups(data);
  };

  const checkLeaderStatus = async () => {
    if (!currentGroupId) return;
    
    const { data } = await supabase
      .from("group_members")
      .select("is_leader")
      .eq("student_id", userId)
      .eq("group_id", currentGroupId)
      .maybeSingle();
    
    setIsLeader(data?.is_leader || false);
  };

  const fetchGroupMembers = async () => {
    if (!currentGroupId) return;

    const { data } = await supabase
      .from("group_members")
      .select(`
        id,
        student_id,
        is_leader,
        profiles(id, email, first_name, last_name, student_id)
      `)
      .eq("group_id", currentGroupId);

    if (data) setGroupMembers(data as any);
  };

  const handleCreateGroup = async () => {
    setIsLoading(true);
    try {
      // Validate input data
      const validatedData = studentGroupSchema.parse({
        name: newGroupName,
        major: newGroupMajor,
        year_level: newGroupYear,
        required_sessions: 3
      });

      // Create group with validated data
      const { data: newGroup, error: groupError } = await supabase
        .from("student_groups")
        .insert([validatedData])
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as leader
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          student_id: userId,
          group_id: newGroup.id,
          is_leader: true
        });

      if (memberError) throw memberError;

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          group_id: newGroup.id,
          major: newGroupMajor,
          year_level: newGroupYear
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      toast({
        title: "สร้างกลุ่มสำเร็จ",
        description: "คุณเป็นหัวหน้ากลุ่มแล้ว"
      });

      setShowCreateDialog(false);
      setNewGroupName("");
      setNewGroupMajor("");
      setNewGroupYear("");
      fetchGroups();
      onGroupChange();
    } catch (error: any) {
      // Better error handling
      const errorMessage = error.message || "กรุณาตรวจสอบข้อมูลอีกครั้ง";
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    setIsLoading(true);
    try {
      // Add to group_members
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          student_id: userId,
          group_id: groupId,
          is_leader: false
        });

      if (memberError) throw memberError;

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ group_id: groupId })
        .eq("id", userId);

      if (profileError) throw profileError;

      toast({
        title: "เข้าร่วมกลุ่มสำเร็จ"
      });

      onGroupChange();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async (student: Student) => {
    if (!currentGroupId) return;

    try {
      const { error } = await supabase
        .from("group_members")
        .insert({
          student_id: student.id,
          group_id: currentGroupId,
          is_leader: false
        });

      if (error) throw error;

      // Update the new member's profile
      await supabase
        .from("profiles")
        .update({ group_id: currentGroupId })
        .eq("id", student.id);

      toast({
        title: "เพิ่มสมาชิกสำเร็จ",
        description: `เพิ่ม ${student.first_name} ${student.last_name} เข้ากลุ่มแล้ว`
      });

      fetchGroupMembers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message
      });
    }
  };

  const handleRemoveMember = async (memberId: string, studentId: string) => {
    if (!window.confirm("ต้องการลบสมาชิกคนนี้ออกจากกลุ่มหรือไม่?")) return;

    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      // Update the member's profile
      await supabase
        .from("profiles")
        .update({ group_id: null })
        .eq("id", studentId);

      toast({
        title: "ลบสมาชิกสำเร็จ"
      });

      fetchGroupMembers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message
      });
    }
  };

  const currentGroup = groups.find(g => g.id === currentGroupId);

  return (
    <div className="space-y-4">
      {!currentGroupId ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              เลือกหรือสร้างกลุ่ม
            </CardTitle>
            <CardDescription>คุณยังไม่มีกลุ่ม กรุณาเลือกกลุ่มที่มีอยู่หรือสร้างกลุ่มใหม่</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>เลือกกลุ่มที่มีอยู่</Label>
              <Select value={selectedGroup} onValueChange={(value) => {
                setSelectedGroup(value);
                handleJoinGroup(value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกกลุ่ม" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} - {group.major} ปี {group.year_level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">หรือ</span>
              </div>
            </div>

            <Button 
              onClick={() => setShowCreateDialog(true)} 
              variant="outline" 
              className="w-full"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              สร้างกลุ่มใหม่
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {currentGroup?.name}
                  {isLeader && <Badge><Crown className="w-3 h-3 mr-1" />หัวหน้ากลุ่ม</Badge>}
                </CardTitle>
                <CardDescription>
                  {currentGroup?.major} ปี {currentGroup?.year_level}
                </CardDescription>
              </div>
              <Button onClick={() => setShowMembersDialog(true)}>
                จัดการสมาชิก ({groupMembers.length})
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Create Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>สร้างกลุ่มใหม่</DialogTitle>
            <DialogDescription>กรอกข้อมูลกลุ่มของคุณ คุณจะเป็นหัวหน้ากลุ่มโดยอัตโนมัติ</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ชื่อกลุ่ม</Label>
              <Input
                placeholder="เช่น กลุ่ม 1"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>สาขา</Label>
              <Input
                placeholder="เช่น วิทยาการคอมพิวเตอร์"
                value={newGroupMajor}
                onChange={(e) => setNewGroupMajor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>ชั้นปี</Label>
              <Select value={newGroupYear} onValueChange={setNewGroupYear}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกชั้นปี" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">ปี 1</SelectItem>
                  <SelectItem value="2">ปี 2</SelectItem>
                  <SelectItem value="3">ปี 3</SelectItem>
                  <SelectItem value="4">ปี 4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleCreateGroup} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "กำลังสร้าง..." : "สร้างกลุ่ม"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>สมาชิกกลุ่ม</DialogTitle>
            <DialogDescription>
              {isLeader ? "คุณสามารถเพิ่มหรือลบสมาชิกได้" : "รายชื่อสมาชิกในกลุ่ม"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {isLeader && (
              <div className="space-y-2">
                <Label>เพิ่มสมาชิกใหม่</Label>
                <SmartStudentSearch
                  onSelectStudent={handleAddMember}
                  excludeStudentIds={groupMembers.map(m => m.student_id)}
                  placeholder="ค้นหานักศึกษาเพื่อเพิ่มเข้ากลุ่ม..."
                />
                <Alert>
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    ใช้ระบบค้นหาอัจฉริยะ: พิมพ์ชื่อ, นามสกุล, รหัสนักศึกษา หรืออีเมล
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="space-y-2">
              <Label>รายชื่อสมาชิก ({groupMembers.length} คน)</Label>
              <div className="space-y-2">
                {groupMembers.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {member.profiles.first_name} {member.profiles.last_name}
                          </span>
                          {member.is_leader && (
                            <Badge variant="default">
                              <Crown className="w-3 h-3 mr-1" />
                              หัวหน้า
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{member.profiles.email}</p>
                        {member.profiles.student_id && (
                          <p className="text-xs text-muted-foreground">รหัส: {member.profiles.student_id}</p>
                        )}
                      </div>
                      {isLeader && !member.is_leader && member.student_id !== userId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id, member.student_id)}
                        >
                          <UserMinus className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}