import { ImagePlus, LoaderCircle, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { createCustomTheme, useThemeStore } from "../theme";

export function CustomThemeUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const addCustomTheme = useThemeStore((state) => state.addCustomTheme);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const upload = async (file?: File) => {
    if (!file) return;
    setProcessing(true);
    setMessage("正在读取画面的色彩与氛围…");
    try {
      const theme = await createCustomTheme(file);
      addCustomTheme(theme);
      setMessage("专属主题已生成并保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "主题生成失败，请换一张图片重试");
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return <div className="custom-theme-uploader">
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => upload(event.target.files?.[0])}/>
    <button disabled={processing} onClick={() => inputRef.current?.click()}>
      {processing ? <LoaderCircle className="upload-spinner" size={20}/> : <ImagePlus size={20}/>}<span><strong>{processing ? "生成主题中" : "上传我的壁纸"}</strong><small>本地分析颜色并生成完整视觉系统</small></span><Sparkles size={16}/>
    </button>
    {message && <p aria-live="polite">{message}</p>}
  </div>;
}
