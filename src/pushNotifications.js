export async function dispatchLolzPush(supabase, payload) {
  if (!supabase?.functions?.invoke || !payload?.action) return null;

  try {
    const { data, error } = await supabase.functions.invoke("lolz-push", {
      body: payload,
    });

    if (error) {
      console.warn("LOLZ push dispatch failed:", error.message || error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.warn("LOLZ push dispatch unavailable:", error?.message || error);
    return null;
  }
}
