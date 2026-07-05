import type { AdminCreateUserInput, AdminUpdateUserInput, EnglishLevel, User, UserRole } from "@english-learning/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BookOpenText,
  Dumbbell,
  Edit3,
  KeyRound,
  Library,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound
} from "lucide-react";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { LoadingState } from "@/components/LoadingState";
import { ProtectedPage } from "@/components/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, ApiClientError } from "@/lib/api";
import { cn, formatLevel } from "@/lib/utils";
import { PageHeader } from "./VocabularyPage";

const pageSize = 20;
const levelOptions = ["", "A1", "A2", "B1", "B2", "C1"] as const;
const roleOptions = ["", "learner", "admin"] as const;

type AccountDialog =
  | { mode: "create"; user?: undefined }
  | { mode: "edit"; user: User }
  | { mode: "password"; user: User }
  | { mode: "delete"; user: User }
  | null;

const roleLabels: Record<UserRole, string> = {
  learner: "学习者",
  admin: "管理员"
};

const numberFormatter = new Intl.NumberFormat("zh-CN");

export function AdminPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]>("");
  const [level, setLevel] = useState<(typeof levelOptions)[number]>("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<AccountDialog>(null);

  const summary = useQuery({ queryKey: ["admin", "summary"], queryFn: api.adminSummary });
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: api.adminSettings });
  const users = useQuery({
    queryKey: ["admin", "users", { query, role, level, page, pageSize }],
    queryFn: () =>
      api.adminUsers({
        q: query.trim() || undefined,
        role: role || undefined,
        level: level || undefined,
        page,
        pageSize
      })
  });

  async function refreshAdminData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] })
    ]);
  }

  const createUser = useMutation({
    mutationFn: api.createAdminUser,
    onSuccess: async () => {
      setDialog(null);
      await refreshAdminData();
    }
  });
  const updateUser = useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AdminUpdateUserInput }) => api.updateAdminUser(userId, input),
    onSuccess: async () => {
      setDialog(null);
      await refreshAdminData();
    }
  });
  const resetPassword = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) => api.resetAdminUserPassword(userId, { password }),
    onSuccess: async () => {
      setDialog(null);
      await refreshAdminData();
    }
  });
  const deleteUser = useMutation({
    mutationFn: api.deleteAdminUser,
    onSuccess: async () => {
      setDialog(null);
      await refreshAdminData();
    }
  });
  const updateSettings = useMutation({
    mutationFn: api.updateAdminSettings,
    onSuccess: async (data) => {
      queryClient.setQueryData(["admin", "settings"], data);
      await queryClient.invalidateQueries({ queryKey: ["auth-config"] });
    }
  });

  useEffect(() => {
    setPage(1);
  }, [query, role, level]);

  const totals = summary.data?.totals;
  const totalPages = users.data?.totalPages ?? 1;
  const mutationError = [createUser.error, updateUser.error, resetPassword.error, deleteUser.error].find(
    (error) => error instanceof ApiClientError
  );
  const errorMessage = mutationError instanceof ApiClientError ? mutationError.message : null;
  const busy = createUser.isPending || updateUser.isPending || resetPassword.isPending || deleteUser.isPending;

  return (
    <ProtectedPage requireAdmin requireLevel={false}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            eyebrow="管理员后台"
            title="账号管理台。"
            description="普通学习者账号支持新增、编辑、重置密码和删除；管理员账号只读保护。"
          />
          <Button className="w-full sm:w-fit" variant="primary" onClick={() => setDialog({ mode: "create" })}>
            <Plus className="h-4 w-4" />
            新增学习者
          </Button>
        </div>

        {summary.isLoading ? (
          <LoadingState />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard icon={UsersRound} label="用户总数" value={totals?.users ?? 0} tone="action" />
            <MetricCard icon={ShieldCheck} label="管理员" value={totals?.admins ?? 0} tone="action" />
            <MetricCard icon={Activity} label="今日活跃" value={totals?.activeToday ?? 0} tone="accent" />
            <MetricCard icon={BookOpenText} label="词库" value={totals?.vocabularyItems ?? 0} tone="accent" />
            <MetricCard icon={Library} label="课程" value={totals?.lessons ?? 0} tone="accent" />
            <MetricCard icon={Dumbbell} label="练习" value={totals?.exercises ?? 0} tone="accent" />
          </div>
        )}

        <RegistrationSettingsCard
          enabled={settings.data?.settings.registrationEnabled ?? false}
          loading={settings.isLoading}
          busy={updateSettings.isPending}
          errorMessage={updateSettings.error instanceof ApiClientError ? updateSettings.error.message : null}
          onToggle={(registrationEnabled) => updateSettings.mutate({ registrationEnabled })}
        />

        <Card className="overflow-hidden bg-white/82">
          <CardHeader className="border-b border-[color:var(--hairline)] bg-[var(--surface-1)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <CardTitle>账号目录</CardTitle>
                <CardDescription>查询、创建和维护普通学习者账号；管理员行会被锁定。</CardDescription>
              </div>
              <Badge>{users.data?.total ?? 0} 个结果</Badge>
            </div>
            <div className="grid gap-3 pt-2 lg:grid-cols-[minmax(0,1fr)_160px_160px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  className="pl-11"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索昵称或邮箱"
                />
              </label>
              <Select value={role} onChange={(event) => setRole(event.target.value as (typeof roleOptions)[number])}>
                <option value="">全部角色</option>
                <option value="learner">学习者</option>
                <option value="admin">管理员</option>
              </Select>
              <Select value={level} onChange={(event) => setLevel(event.target.value as (typeof levelOptions)[number])}>
                <option value="">全部等级</option>
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {users.isLoading ? (
              <div className="p-6">
                <LoadingState />
              </div>
            ) : (
              <AccountDirectory
                users={users.data?.users ?? []}
                onEdit={(user) => setDialog({ mode: "edit", user })}
                onPassword={(user) => setDialog({ mode: "password", user })}
                onDelete={(user) => setDialog({ mode: "delete", user })}
              />
            )}

            <div className="flex flex-col gap-3 border-t border-[color:var(--hairline)] bg-[var(--surface-1)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-[var(--muted)]">
                第 {page} / {totalPages} 页
              </p>
              <div className="flex gap-2">
                <Button size="sm" disabled={page <= 1 || users.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  上一页
                </Button>
                <Button size="sm" disabled={page >= totalPages || users.isFetching} onClick={() => setPage((value) => value + 1)}>
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AccountDialog
        dialog={dialog}
        busy={busy}
        errorMessage={errorMessage}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null);
        }}
        onCreate={(input) => createUser.mutate(input)}
        onUpdate={(userId, input) => updateUser.mutate({ userId, input })}
        onResetPassword={(userId, password) => resetPassword.mutate({ userId, password })}
        onDelete={(userId) => deleteUser.mutate(userId)}
      />
    </ProtectedPage>
  );
}

function AccountDirectory({
  users,
  onEdit,
  onPassword,
  onDelete
}: {
  users: User[];
  onEdit: (user: User) => void;
  onPassword: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  if (users.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-[24px] border border-dashed border-[color:var(--hairline)] bg-[var(--surface-1)] p-8 text-center">
          <p className="text-base font-extrabold text-[var(--text)]">没有匹配的用户</p>
          <p className="mt-2 text-sm font-semibold text-[var(--muted)]">换一个搜索词或清空筛选条件。</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden lg:block">
        <div className="grid grid-cols-[minmax(260px,360px)_104px_96px_168px_minmax(220px,1fr)] items-center gap-3 border-b border-[color:var(--hairline)] px-5 py-3 text-xs font-extrabold text-[var(--muted)]">
          <span>账号</span>
          <span>角色</span>
          <span>等级</span>
          <span className="whitespace-nowrap">创建时间</span>
          <span className="text-right">操作</span>
        </div>
        <div className="divide-y divide-[color:var(--hairline)]">
          {users.map((user) => (
            <AccountTableRow key={user.id} user={user} onEdit={onEdit} onPassword={onPassword} onDelete={onDelete} />
          ))}
        </div>
      </div>

      <div className="space-y-3 p-4 lg:hidden">
        {users.map((user) => (
          <AccountMobileCard key={user.id} user={user} onEdit={onEdit} onPassword={onPassword} onDelete={onDelete} />
        ))}
      </div>
    </>
  );
}

function AccountTableRow({
  user,
  onEdit,
  onPassword,
  onDelete
}: {
  user: User;
  onEdit: (user: User) => void;
  onPassword: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  const protectedAdmin = user.role === "admin";

  return (
    <div className="grid min-h-[76px] grid-cols-[minmax(260px,360px)_104px_96px_168px_minmax(220px,1fr)] items-center gap-3 px-5 py-4">
      <AccountIdentity user={user} />
      <RoleBadge role={user.role} />
      <Badge>{formatLevel(user.level)}</Badge>
      <span className="whitespace-nowrap text-sm font-semibold text-[var(--muted)]">{formatDate(user.createdAt)}</span>
      <div className="flex justify-end gap-2">
        {protectedAdmin ? (
          <span className="rounded-full border border-[color:var(--hairline)] bg-white/64 px-3 py-2 text-xs font-extrabold text-[var(--muted)]">
            管理员受保护
          </span>
        ) : (
          <>
            <Button size="sm" onClick={() => onEdit(user)}>
              <Edit3 className="h-3.5 w-3.5" />
              编辑
            </Button>
            <Button size="sm" onClick={() => onPassword(user)}>
              <KeyRound className="h-3.5 w-3.5" />
              密码
            </Button>
            <Button size="sm" variant="danger" onClick={() => onDelete(user)}>
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function AccountMobileCard({
  user,
  onEdit,
  onPassword,
  onDelete
}: {
  user: User;
  onEdit: (user: User) => void;
  onPassword: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  const protectedAdmin = user.role === "admin";

  return (
    <div className="rounded-[24px] border border-[color:var(--hairline)] bg-[var(--surface-1)] p-4">
      <AccountIdentity user={user} />
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <InfoCell label="角色" value={<RoleBadge role={user.role} />} />
        <InfoCell label="等级" value={<Badge>{formatLevel(user.level)}</Badge>} />
        <InfoCell label="创建" value={formatDate(user.createdAt)} />
        <InfoCell label="状态" value={protectedAdmin ? "受保护" : "可管理"} />
      </div>
      {protectedAdmin ? (
        <p className="mt-4 rounded-[18px] border border-[color:var(--hairline)] bg-white/60 px-4 py-3 text-sm font-bold text-[var(--muted)]">
          管理员账号不在普通账号管理范围内。
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button size="sm" onClick={() => onEdit(user)}>
            编辑
          </Button>
          <Button size="sm" onClick={() => onPassword(user)}>
            密码
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(user)}>
            删除
          </Button>
        </div>
      )}
    </div>
  );
}

function AccountIdentity({ user }: { user: User }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--action-soft)] text-sm font-black text-[var(--action-strong)]">
        {user.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-extrabold text-[var(--text)]">{user.name}</span>
        <span className="mt-1 block truncate text-xs font-semibold text-[var(--muted)]">{user.email}</span>
      </span>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-[color:var(--hairline)] bg-white/56 px-3 py-2">
      <p className="text-xs font-extrabold text-[var(--muted)]">{label}</p>
      <div className="mt-1 text-sm font-bold text-[var(--text)]">{value}</div>
    </div>
  );
}

function AccountDialog({
  dialog,
  busy,
  errorMessage,
  onOpenChange,
  onCreate,
  onUpdate,
  onResetPassword,
  onDelete
}: {
  dialog: AccountDialog;
  busy: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: AdminCreateUserInput) => void;
  onUpdate: (userId: string, input: AdminUpdateUserInput) => void;
  onResetPassword: (userId: string, password: string) => void;
  onDelete: (userId: string) => void;
}) {
  return (
    <Dialog open={Boolean(dialog)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {dialog?.mode === "create" ? (
          <CreateAccountForm busy={busy} errorMessage={errorMessage} onCreate={onCreate} />
        ) : dialog?.mode === "edit" ? (
          <EditAccountForm user={dialog.user} busy={busy} errorMessage={errorMessage} onUpdate={onUpdate} />
        ) : dialog?.mode === "password" ? (
          <ResetPasswordForm user={dialog.user} busy={busy} errorMessage={errorMessage} onResetPassword={onResetPassword} />
        ) : dialog?.mode === "delete" ? (
          <DeleteAccountConfirm user={dialog.user} busy={busy} errorMessage={errorMessage} onDelete={onDelete} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateAccountForm({
  busy,
  errorMessage,
  onCreate
}: {
  busy: boolean;
  errorMessage: string | null;
  onCreate: (input: AdminCreateUserInput) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState<EnglishLevel | "">("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onCreate({ name, email, password, level: level || null });
  }

  return (
    <form className="space-y-5 p-6" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>新增学习者</DialogTitle>
        <DialogDescription>创建普通学习账号。管理员账号只通过服务器环境变量初始化。</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="昵称">
          <Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} required />
        </Field>
        <Field label="邮箱">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </Field>
        <Field label="初始密码">
          <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} required />
        </Field>
        <Field label="等级">
          <LevelSelect value={level} onChange={setLevel} />
        </Field>
      </div>
      <DialogActions errorMessage={errorMessage}>
        <Button variant="primary" disabled={busy}>
          创建账号
        </Button>
      </DialogActions>
    </form>
  );
}

function EditAccountForm({
  user,
  busy,
  errorMessage,
  onUpdate
}: {
  user: User;
  busy: boolean;
  errorMessage: string | null;
  onUpdate: (userId: string, input: AdminUpdateUserInput) => void;
}) {
  const [name, setName] = useState(user.name);
  const [level, setLevel] = useState<EnglishLevel | "">(user.level ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    onUpdate(user.id, { name, level: level || null });
  }

  return (
    <form className="space-y-5 p-6" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>编辑学习者</DialogTitle>
        <DialogDescription>{user.email}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="昵称">
          <Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} required />
        </Field>
        <Field label="等级">
          <LevelSelect value={level} onChange={setLevel} />
        </Field>
      </div>
      <DialogActions errorMessage={errorMessage}>
        <Button variant="primary" disabled={busy}>
          保存修改
        </Button>
      </DialogActions>
    </form>
  );
}

function ResetPasswordForm({
  user,
  busy,
  errorMessage,
  onResetPassword
}: {
  user: User;
  busy: boolean;
  errorMessage: string | null;
  onResetPassword: (userId: string, password: string) => void;
}) {
  const [password, setPassword] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onResetPassword(user.id, password);
  }

  return (
    <form className="space-y-5 p-6" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>重置密码</DialogTitle>
        <DialogDescription>{user.email}</DialogDescription>
      </DialogHeader>
      <Field label="新密码">
        <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} required />
      </Field>
      <DialogActions errorMessage={errorMessage}>
        <Button variant="primary" disabled={busy}>
          更新密码
        </Button>
      </DialogActions>
    </form>
  );
}

function DeleteAccountConfirm({
  user,
  busy,
  errorMessage,
  onDelete
}: {
  user: User;
  busy: boolean;
  errorMessage: string | null;
  onDelete: (userId: string) => void;
}) {
  return (
    <div className="space-y-5 p-6">
      <DialogHeader>
        <DialogTitle>删除学习者账号</DialogTitle>
        <DialogDescription>删除后会同时清理该用户的学习进度、复习记录和练习尝试。</DialogDescription>
      </DialogHeader>
      <div className="rounded-[24px] border border-[color:rgba(201,101,101,0.18)] bg-[rgba(201,101,101,0.08)] p-4">
        <AccountIdentity user={user} />
      </div>
      <DialogActions errorMessage={errorMessage}>
        <Button type="button" variant="danger" disabled={busy} onClick={() => onDelete(user.id)}>
          确认删除
        </Button>
      </DialogActions>
    </div>
  );
}

function DialogActions({ children, errorMessage }: { children: ReactNode; errorMessage: string | null }) {
  return (
    <div className="flex flex-col gap-3 border-t border-[color:var(--hairline)] pt-5 sm:flex-row sm:items-center sm:justify-between">
      {errorMessage ? <p className="text-sm font-bold text-[var(--danger)]">{errorMessage}</p> : <span />}
      <div className="flex justify-end">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-extrabold text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function LevelSelect({ value, onChange }: { value: EnglishLevel | ""; onChange: (value: EnglishLevel | "") => void }) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value as EnglishLevel | "")}>
      <option value="">未选择</option>
      <option value="A1">A1</option>
      <option value="A2">A2</option>
      <option value="B1">B1</option>
      <option value="B2">B2</option>
      <option value="C1">C1</option>
    </Select>
  );
}

function RegistrationSettingsCard({
  enabled,
  loading,
  busy,
  errorMessage,
  onToggle
}: {
  enabled: boolean;
  loading: boolean;
  busy: boolean;
  errorMessage: string | null;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <Card className="bg-white/82">
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--action-soft)] text-[var(--action-strong)]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-extrabold text-[var(--text)]">注册入口</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[var(--muted)]">
                默认关闭。关闭后用户不能自助注册，管理员仍可在后台创建学习者账号。
              </p>
            </div>
            <Badge className={enabled ? "text-[var(--accent-light)]" : "text-[var(--muted)]"}>
              {loading ? "检查中" : enabled ? "已开放" : "已关闭"}
            </Badge>
          </div>
          {errorMessage ? <p className="mt-3 text-sm font-bold text-[var(--danger)]">{errorMessage}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button variant={enabled ? "secondary" : "primary"} disabled={loading || busy || enabled} onClick={() => onToggle(true)}>
            开放注册
          </Button>
          <Button variant={enabled ? "danger" : "secondary"} disabled={loading || busy || !enabled} onClick={() => onToggle(false)}>
            关闭注册
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof UsersRound;
  label: string;
  value: number;
  tone: "action" | "accent";
}) {
  return (
    <Card className="bg-white/82">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              "grid h-10 w-10 place-items-center rounded-full",
              tone === "action" ? "bg-[var(--action-soft)] text-[var(--action-strong)]" : "bg-[var(--accent-soft)] text-[var(--accent-light)]"
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span className="text-2xl font-black leading-none text-[var(--text)]">{numberFormatter.format(value)}</span>
        </div>
        <p className="mt-4 text-sm font-extrabold text-[var(--muted)]">{label}</p>
      </CardContent>
    </Card>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-extrabold",
        role === "admin"
          ? "border-[color:rgba(245,134,123,0.28)] bg-[var(--action-soft)] text-[var(--action-strong)]"
          : "border-[color:rgba(143,174,111,0.28)] bg-[var(--accent-soft)] text-[var(--accent-light)]"
      )}
    >
      {roleLabels[role]}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value)
  );
}
