import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Send } from "lucide-react";

interface LINENotificationSenderProps {
  userId: string;
  role: "teacher" | "admin" | "super_admin";
}

interface LINEChannel {
  id: string;
  name: string;
}

export const LINENotificationSender = ({ userId, role }: LINENotificationSenderProps) => {
  const [channels, setChannels] = useState<LINEChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    if (role === "super_admin") {
      // Super admin can see all channels
      const { data } = await supabase
        .from("line_notifications")
        .select("id, name")
        .eq("enabled", true);
      
      setChannels(data || []);
    } else {
      // Teachers can only see their assigned channels
      const { data } = await supabase
        .from("line_channel_assignments")
        .select("line_notification_id, line_notifications(id, name)")
        .eq("teacher_id", userId);
      
      const teacherChannels = data?.map(item => ({
        id: item.line_notifications.id,
        name: item.line_notifications.name
      })) || [];
      
      setChannels(teacherChannels);
    }
  };

  const handleSend = async () => {
    if (!selectedChannel || !message.trim()) {
      toast({
        variant: "destructive",
        title: "กรุณากรอกข้อมูลให้ครบ",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-line-notification", {
        body: {
          message: message.trim(),
          channelId: selectedChannel,
        },
      });

      if (error) throw error;

      toast({
        title: "ส่งข้อความสำเร็จ",
        description: "ส่งข้อความไปยัง LINE แล้ว",
      });

      setMessage("");
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
        <CardTitle>ส่งข้อความไปยัง LINE</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>เลือก LINE Channel</Label>
          <Select value={selectedChannel} onValueChange={setSelectedChannel}>
            <SelectTrigger>
              <SelectValue placeholder="เลือก Channel" />
            </SelectTrigger>
            <SelectContent>
              {channels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>ข้อความ</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
            rows={4}
          />
        </div>

        <Button 
          onClick={handleSend} 
          disabled={isLoading || !selectedChannel || !message.trim()}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          ส่งข้อความ
        </Button>
      </CardContent>
    </Card>
  );
};
