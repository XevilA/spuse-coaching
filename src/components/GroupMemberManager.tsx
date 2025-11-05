import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GroupMemberManagerProps {
  userId: string;
  groupId: string;
}

export const GroupMemberManager = ({ userId, groupId }: GroupMemberManagerProps) => {
  const [members, setMembers] = useState<any[]>([]);
  const [isLeader, setIsLeader] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMembers();
    checkLeaderStatus();
  }, [userId, groupId]);

  const checkLeaderStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("group_members")
        .select("is_leader")
        .eq("student_id", userId)
        .eq("group_id", groupId)
        .single();

      if (error) throw error;
      setIsLeader(data?.is_leader || false);
    } catch (error) {
      console.error("Error checking leader status:", error);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("group_members")
        .select(`
          *,
          student:profiles!group_members_student_id_fkey(
            id,
            first_name,
            last_name,
            student_id,
            email
          )
        `)
        .eq("group_id", groupId);

      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      console.error("Error fetching members:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกอีเมล",
        description: "กรุณากรอกอีเมลของสมาชิกที่ต้องการเพิ่ม",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Find student by email
      const { data: studentData, error: studentError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", newMemberEmail)
        .single();

      if (studentError) {
        toast({
          variant: "destructive",
          title: "ไม่พบนักศึกษา",
          description: "ไม่พบนักศึกษาที่มีอีเมลนี้ในระบบ",
        });
        return;
      }

      // Add member to group
      const { error: insertError } = await supabase
        .from("group_members")
        .insert({
          group_id: groupId,
          student_id: studentData.id,
          is_leader: false,
        });

      if (insertError) throw insertError;

      // Update student's group_id in profiles
      await supabase
        .from("profiles")
        .update({ group_id: groupId })
        .eq("id", studentData.id);

      toast({
        title: "เพิ่มสมาชิกสำเร็จ",
        description: "เพิ่มสมาชิกในกลุ่มเรียบร้อยแล้ว",
      });

      setNewMemberEmail("");
      fetchMembers();
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

  const handleRemoveMember = async (memberId: string, studentId: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบสมาชิกคนนี้ออกจากกลุ่ม?")) return;

    try {
      const { error: deleteError } = await supabase
        .from("group_members")
        .delete()
        .eq("id", memberId);

      if (deleteError) throw deleteError;

      // Clear group_id in profiles
      await supabase
        .from("profiles")
        .update({ group_id: null })
        .eq("id", studentId);

      toast({
        title: "ลบสมาชิกสำเร็จ",
        description: "ลบสมาชิกออกจากกลุ่มเรียบร้อยแล้ว",
      });

      fetchMembers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    }
  };

  if (!isLeader) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            สมาชิกในกลุ่ม
          </CardTitle>
          <CardDescription>จำนวนสมาชิก {members.length} คน</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <p className="font-medium">
                    {member.student?.first_name} {member.student?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{member.student?.student_id}</p>
                </div>
                {member.is_leader && (
                  <Badge variant="secondary">หัวหน้ากลุ่ม</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          จัดการสมาชิกในกลุ่ม
        </CardTitle>
        <CardDescription>
          คุณเป็นหัวหน้ากลุ่ม - จำนวนสมาชิก {members.length} คน
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">เพิ่มสมาชิกใหม่</Label>
          <div className="flex gap-2">
            <Input
              id="email"
              type="email"
              placeholder="อีเมลของนักศึกษา (เช่น student@spumail.net)"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddMember()}
            />
            <Button onClick={handleAddMember} disabled={isLoading}>
              <UserPlus className="w-4 h-4 mr-2" />
              เพิ่ม
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">รายชื่อสมาชิก</h4>
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 border rounded hover:bg-accent"
            >
              <div className="flex-1">
                <p className="font-medium">
                  {member.student?.first_name} {member.student?.last_name}
                  {member.is_leader && (
                    <Badge variant="secondary" className="ml-2">
                      หัวหน้ากลุ่ม
                    </Badge>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {member.student?.student_id} • {member.student?.email}
                </p>
              </div>
              {!member.is_leader && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveMember(member.id, member.student?.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
