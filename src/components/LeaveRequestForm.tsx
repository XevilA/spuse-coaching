import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";

interface LeaveRequestFormProps {
  userId: string;
  onSuccess?: () => void;
}

export const LeaveRequestForm = ({ userId, onSuccess }: LeaveRequestFormProps) => {
  const [formData, setFormData] = useState({
    leave_type: "",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.from("leave_requests").insert({
        student_id: userId,
        ...formData,
      });

      if (error) throw error;

      toast({
        title: "สำเร็จ",
        description: "ส่งคำขอลาแล้ว",
      });

      setFormData({
        leave_type: "",
        start_date: "",
        end_date: "",
        reason: "",
      });

      onSuccess?.();
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>ยื่นคำขอลา</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>ประเภทการลา</Label>
            <Select
              value={formData.leave_type}
              onValueChange={(value) => setFormData({ ...formData, leave_type: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="เลือกประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sick">ลาป่วย</SelectItem>
                <SelectItem value="personal">ลากิจ</SelectItem>
                <SelectItem value="other">อื่นๆ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>วันที่เริ่มต้น</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>วันที่สิ้นสุด</Label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label>เหตุผล</Label>
            <Textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="กรุณาระบุเหตุผล"
              required
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            ส่งคำขอ
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
