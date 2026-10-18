<script lang="ts">
  import type { IProfile } from "eml-lib"
  let { profile }: { profile: IProfile } = $props()
</script>

<div hidden>{profile.name}</div>
