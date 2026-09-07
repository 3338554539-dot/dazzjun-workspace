import { AccountDataProvider, useAccountData, useAuth } from "../auth";
import { App } from "../App";
import { AuthGateway, PlatformLoading } from "./AuthGateway";
import { LegacyDataPrompt } from "./LegacyDataPrompt";

function AccountWorkspace() {
  const { ready, error, retry } = useAccountData();
  if (!ready) return error ? <main className="platform-loading"><div><strong>暂时无法载入你的空间</strong><small>{error}</small><button onClick={() => void retry()}>重新连接</button></div></main> : <PlatformLoading message="正在载入你的成长数据"/>;
  return <><App/><LegacyDataPrompt/></>;
}

export function PlatformGate() {
  const { authStatus, user } = useAuth();
  console.info(`[PLATFORM_GATE]\npathname: ${window.location.pathname}\nauthStatus: ${authStatus}\nuser: ${user?.id ?? "null"}\ntime: ${new Date().toISOString()}`);
  if (authStatus === "loading") return <PlatformLoading/>;
  if (authStatus === "unauthenticated") return <AuthGateway/>;
  if (!user) return <PlatformLoading message="正在恢复你的私人空间"/>;
  return <AccountDataProvider><AccountWorkspace/></AccountDataProvider>;
}
