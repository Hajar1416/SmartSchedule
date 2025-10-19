-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.course_prerequisites (
  course_id uuid NOT NULL,
  prerequisite_id uuid NOT NULL,
  should_align_schedule boolean DEFAULT false,
  CONSTRAINT course_prerequisites_pkey PRIMARY KEY (course_id, prerequisite_id),
  CONSTRAINT course_prerequisites_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_prerequisites_prerequisite_id_fkey FOREIGN KEY (prerequisite_id) REFERENCES public.courses(id)
);
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  level integer NOT NULL CHECK (level >= 1 AND level <= 8),
  credits numeric NOT NULL DEFAULT 3.0,
  course_type USER-DEFINED NOT NULL DEFAULT 'compulsory'::course_type,
  is_lab boolean DEFAULT false,
  duration_hours numeric DEFAULT 1.5,
  allowable_rooms ARRAY,
  category text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT courses_pkey PRIMARY KEY (id)
);
CREATE TABLE public.elective_choices (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid,
  course_id uuid,
  priority integer NOT NULL CHECK (priority >= 1 AND priority <= 5),
  semester text NOT NULL,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT elective_choices_pkey PRIMARY KEY (id),
  CONSTRAINT elective_choices_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT elective_choices_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.faculty (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  faculty_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  department text,
  contact text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT faculty_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.irregular_course_requirements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid,
  course_id uuid,
  original_level integer NOT NULL,
  failed_semester text,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT irregular_course_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT irregular_course_requirements_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT irregular_course_requirements_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.irregular_schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid,
  enrolled_level integer NOT NULL CHECK (enrolled_level >= 1 AND enrolled_level <= 8),
  semester text NOT NULL,
  schedule_data jsonb NOT NULL,
  total_courses integer DEFAULT 0,
  total_credits numeric DEFAULT 0,
  conflicts integer DEFAULT 0,
  generated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT irregular_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT irregular_schedules_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.level_group_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  level integer NOT NULL CHECK (level >= 1 AND level <= 8),
  semester text NOT NULL,
  total_students integer NOT NULL DEFAULT 0,
  students_per_group integer NOT NULL DEFAULT 25,
  num_groups integer NOT NULL DEFAULT 0,
  group_names ARRAY NOT NULL DEFAULT ARRAY['A'::text, 'B'::text, 'C'::text],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT level_group_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.rule_definitions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  rule_text text NOT NULL,
  rule_category text NOT NULL DEFAULT 'general'::text,
  priority integer DEFAULT 1,
  is_active boolean DEFAULT true,
  applies_to_levels ARRAY DEFAULT '{}'::integer[],
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rule_definitions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.schedule_comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  schedule_version_id uuid,
  irregular_schedule_id uuid,
  student_id uuid,
  faculty_id uuid,
  comment_type USER-DEFINED NOT NULL DEFAULT 'general'::comment_type,
  comment_text text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::comment_status,
  admin_reply text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schedule_comments_pkey PRIMARY KEY (id),
  CONSTRAINT schedule_comments_schedule_version_id_fkey FOREIGN KEY (schedule_version_id) REFERENCES public.schedule_versions(id),
  CONSTRAINT schedule_comments_irregular_schedule_id_fkey FOREIGN KEY (irregular_schedule_id) REFERENCES public.irregular_schedules(id),
  CONSTRAINT schedule_comments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT schedule_comments_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id)
);
CREATE TABLE public.schedule_sections (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  schedule_version_id uuid,
  course_code text NOT NULL,
  section_label text NOT NULL,
  day text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  room text NOT NULL,
  instructor text,
  student_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schedule_sections_pkey PRIMARY KEY (id),
  CONSTRAINT schedule_sections_schedule_version_id_fkey FOREIGN KEY (schedule_version_id) REFERENCES public.schedule_versions(id)
);
CREATE TABLE public.schedule_versions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  level integer NOT NULL CHECK (level >= 1 AND level <= 8),
  semester text NOT NULL,
  groups jsonb NOT NULL,
  total_sections integer DEFAULT 0,
  efficiency numeric,
  conflicts integer DEFAULT 0,
  generated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schedule_versions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  student_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  level integer NOT NULL CHECK (level >= 1 AND level <= 8),
  contact text,
  is_irregular boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  student_group text DEFAULT 'A'::text,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.system_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT system_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text,
  role USER-DEFINED NOT NULL DEFAULT 'student'::user_role,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);