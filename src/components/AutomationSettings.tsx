import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface NotificationPreference {
  id?: string;
  notification_type: 'email' | 'line' | 'both';
  event_type: string;
  enabled: boolean;
  line_channel_id?: string;
}

interface AutomationSettingsProps {
  userId: string;
  role: string;
}

export function AutomationSettings({ userId, role }: AutomationSettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lineChannels, setLineChannels] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const { toast } = useToast();

  const eventTypes = role === 'teacher' 
    ? [
        { value: 'coaching_submitted', label: 'เมื่อนักศึกษาส่งใบ Coaching' },
        { value: 'appointment_booked', label: 'เมื่อนักศึกษานัดหมาย' },
      ]
    : [
        { value: 'coaching_reviewed', label: 'เมื่ออาจารย์ตรวจใบ Coaching' },
        { value: 'appointment_confirmed', label: 'เมื่ออาจารย์ยืนยันนัดหมาย' },
      ];

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      // Fetch user's LINE channels if teacher
      if (role === 'teacher') {
        const { data: channels } = await supabase
          .from('line_channel_assignments')
          .select('line_notifications(*)')
          .eq('teacher_id', userId);
        
        if (channels) {
          setLineChannels(channels.map((c: any) => c.line_notifications).filter(Boolean));
        }
      }

      // Fetch notification preferences
      const { data: prefs, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      // Initialize preferences for all event types
      const initialPrefs = eventTypes.map(et => {
        const existingPref = prefs?.find(p => p.event_type === et.value);
        return existingPref ? {
          ...existingPref,
          notification_type: existingPref.notification_type as 'email' | 'line' | 'both',
        } : {
          notification_type: 'line' as 'email' | 'line' | 'both',
          event_type: et.value,
          enabled: false,
        };
      });

      setPreferences(initialPrefs);
    } catch (error: any) {
      console.error('Error fetching automation settings:', error);
      toast({
        variant: 'destructive',
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const pref of preferences) {
        if (pref.id) {
          // Update existing
          const { error } = await supabase
            .from('notification_preferences')
            .update({
              notification_type: pref.notification_type,
              enabled: pref.enabled,
              line_channel_id: pref.line_channel_id || null,
            })
            .eq('id', pref.id);

          if (error) throw error;
        } else if (pref.enabled) {
          // Insert new (only if enabled)
          const { error } = await supabase
            .from('notification_preferences')
            .insert({
              user_id: userId,
              notification_type: pref.notification_type,
              event_type: pref.event_type,
              enabled: pref.enabled,
              line_channel_id: pref.line_channel_id || null,
            });

          if (error) throw error;
        }
      }

      toast({
        title: 'บันทึกสำเร็จ',
        description: 'ตั้งค่าการแจ้งเตือนอัตโนมัติเรียบร้อยแล้ว',
      });

      fetchData(); // Refresh to get IDs
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'ไม่สามารถบันทึกได้',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreference = (eventType: string, updates: Partial<NotificationPreference>) => {
    setPreferences(prev =>
      prev.map(p =>
        p.event_type === eventType ? { ...p, ...updates } : p
      )
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full" />
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
          <Bell className="w-5 h-5" />
          ตั้งค่าการแจ้งเตือนอัตโนมัติ
        </CardTitle>
        <CardDescription>
          กำหนดว่าต้องการรับการแจ้งเตือนผ่านช่องทางไหน เมื่อมีเหตุการณ์ต่างๆ เกิดขึ้น
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {eventTypes.map(eventType => {
          const pref = preferences.find(p => p.event_type === eventType.value);
          if (!pref) return null;

          return (
            <div key={eventType.value} className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{eventType.label}</h4>
                  <p className="text-sm text-muted-foreground">
                    แจ้งเตือนเมื่อมีเหตุการณ์นี้เกิดขึ้น
                  </p>
                </div>
                <Switch
                  checked={pref.enabled}
                  onCheckedChange={(enabled) =>
                    updatePreference(eventType.value, { enabled })
                  }
                />
              </div>

              {pref.enabled && (
                <div className="space-y-4 pl-4 border-l-2">
                  <div>
                    <Label>ช่องทางการแจ้งเตือน</Label>
                    <Select
                      value={pref.notification_type}
                      onValueChange={(value: 'email' | 'line' | 'both') =>
                        updatePreference(eventType.value, { notification_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <span>อีเมล</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="line">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            <span>LINE</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="both">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <MessageSquare className="w-4 h-4" />
                            <span>ทั้งสองช่องทาง</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(pref.notification_type === 'line' || pref.notification_type === 'both') && 
                   role === 'teacher' && 
                   lineChannels.length > 0 && (
                    <div>
                      <Label>LINE Channel</Label>
                      <Select
                        value={pref.line_channel_id || ''}
                        onValueChange={(value) =>
                          updatePreference(eventType.value, { line_channel_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="เลือก LINE Channel" />
                        </SelectTrigger>
                        <SelectContent>
                          {lineChannels.map(channel => (
                            <SelectItem key={channel.id} value={channel.id}>
                              {channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </Button>
      </CardContent>
    </Card>
  );
}
