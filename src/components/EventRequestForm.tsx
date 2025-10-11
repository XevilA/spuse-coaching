import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";

interface EventRequestFormProps {
  userId: string;
  onSuccess?: () => void;
}

export const EventRequestForm = ({ userId, onSuccess }: EventRequestFormProps) => {
  const [formData, setFormData] = useState({
    event_name: "",
    event_type: "",
    event_date: "",
    start_time: "",
    end_time: "",
    location: "",
    description: "",
    expected_participants: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.from("event_requests").insert({
        student_id: userId,
        ...formData,
        expected_participants: parseInt(formData.expected_participants) || null,
      });

      if (error) throw error;

      toast({
        title: "สำเร็จ",
        description: "ส่งคำขอจัดงานแล้ว",
      });

      setFormData({
        event_name: "",
        event_type: "",
        event_date: "",
        start_time: "",
        end_time: "",
        location: "",
        description: "",
        expected_participants: "",
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
        <CardTitle>ขออนุมัติจัดกิจกรรม</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>ชื่องาน</Label>
            <Input
              value={formData.event_name}
              onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
              placeholder="ชื่อกิจกรรม"
              required
            />
          </div>

          <div>
            <Label>ประเภทงาน</Label>
            <Input
              value={formData.event_type}
              onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
              placeholder="เช่น Seminar, Workshop, Competition"
              required
            />
          </div>

          <div>
            <Label>วันที่จัดงาน</Label>
            <Input
              type="date"
              value={formData.event_date}
              onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>เวลาเริ่ม</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>เวลาสิ้นสุด</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label>สถานที่</Label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="สถานที่จัดงาน"
            />
          </div>

          <div>
            <Label>จำนวนผู้เข้าร่วมโดยประมาณ</Label>
            <Input
              type="number"
              value={formData.expected_participants}
              onChange={(e) => setFormData({ ...formData, expected_participants: e.target.value })}
              placeholder="จำนวนคน"
            />
          </div>

          <div>
            <Label>รายละเอียดงาน</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="รายละเอียดของกิจกรรม"
              required
              rows={4}
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
