package net.yayokorea.auth.fabric;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;

public final class YayoAuthMod implements ModInitializer {
    @Override
    public void onInitialize() {
        PayloadTypeRegistry.clientboundPlay().register(AuthChallengePayload.TYPE, AuthChallengePayload.CODEC);
        PayloadTypeRegistry.serverboundPlay().register(AuthResponsePayload.TYPE, AuthResponsePayload.CODEC);
    }
}
