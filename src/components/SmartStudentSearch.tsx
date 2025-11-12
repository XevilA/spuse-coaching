import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Mail, User, GraduationCap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Student {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  student_id: string | null;
  major: string | null;
  year_level: string | null;
  group_id: string | null;
}

interface SmartStudentSearchProps {
  onSelectStudent: (student: Student) => void;
  excludeStudentIds?: string[];
  placeholder?: string;
}

export function SmartStudentSearch({ 
  onSelectStudent, 
  excludeStudentIds = [],
  placeholder = "ค้นหานักศึกษา (ชื่อ, นามสกุล, รหัสนักศึกษา, อีเมล)"
}: SmartStudentSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();

  // Fetch all students once
  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      
      // Get student role IDs
      const { data: studentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");

      if (!studentRoles) return;

      const studentIds = studentRoles.map(r => r.user_id);

      // Get student profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, student_id, major, year_level, group_id")
        .in("id", studentIds);

      if (profiles) {
        setStudents(profiles);
      }
    } catch (error: any) {
      console.error("Error fetching students:", error);
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดรายชื่อนักศึกษาได้"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Smart search algorithm
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase().trim();
    
    // Score each student based on match quality
    const scored = students
      .filter(s => !excludeStudentIds.includes(s.id))
      .map(student => {
        let score = 0;
        const firstName = (student.first_name || "").toLowerCase();
        const lastName = (student.last_name || "").toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        const email = (student.email || "").toLowerCase();
        const studentId = (student.student_id || "").toLowerCase();
        const major = (student.major || "").toLowerCase();

        // Exact matches get highest score
        if (firstName === query) score += 100;
        if (lastName === query) score += 100;
        if (studentId === query) score += 150;
        if (email === query) score += 150;

        // Starts with gets high score
        if (firstName.startsWith(query)) score += 50;
        if (lastName.startsWith(query)) score += 50;
        if (studentId.startsWith(query)) score += 70;
        if (email.startsWith(query)) score += 60;

        // Contains gets medium score
        if (firstName.includes(query)) score += 30;
        if (lastName.includes(query)) score += 30;
        if (fullName.includes(query)) score += 40;
        if (studentId.includes(query)) score += 45;
        if (email.includes(query)) score += 35;
        if (major.includes(query)) score += 25;

        // Fuzzy matching for typos (simple version)
        const words = query.split(" ");
        words.forEach(word => {
          if (word.length >= 3) {
            if (firstName.includes(word)) score += 15;
            if (lastName.includes(word)) score += 15;
            if (studentId.includes(word)) score += 20;
          }
        });

        return { student, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // Show top 10 results
      .map(item => item.student);

    return scored;
  }, [searchQuery, students, excludeStudentIds]);

  const handleSelectStudent = (student: Student) => {
    onSelectStudent(student);
    setSearchQuery("");
    setShowResults(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="pl-9"
        />
      </div>

      {showResults && searchQuery && filteredStudents.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 max-h-96 overflow-auto shadow-lg">
          <CardContent className="p-2">
            <div className="space-y-1">
              {filteredStudents.map((student) => (
                <Button
                  key={student.id}
                  variant="ghost"
                  className="w-full justify-start h-auto py-3 px-3 hover:bg-accent"
                  onClick={() => handleSelectStudent(student)}
                >
                  <div className="flex flex-col items-start gap-1 w-full">
                    <div className="flex items-center gap-2 w-full">
                      <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">
                        {student.first_name} {student.last_name}
                      </span>
                      {student.group_id && (
                        <Badge variant="secondary" className="ml-auto">มีกลุ่มแล้ว</Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground ml-6">
                      {student.student_id && (
                        <div className="flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          <span>{student.student_id}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <span>{student.email}</span>
                      </div>
                      {student.major && student.year_level && (
                        <span>{student.major} ปี {student.year_level}</span>
                      )}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showResults && searchQuery && filteredStudents.length === 0 && !isLoading && (
        <Card className="absolute z-50 w-full mt-1 shadow-lg">
          <CardContent className="p-4 text-center text-muted-foreground text-sm">
            ไม่พบนักศึกษาที่ตรงกับการค้นหา
          </CardContent>
        </Card>
      )}
    </div>
  );
}