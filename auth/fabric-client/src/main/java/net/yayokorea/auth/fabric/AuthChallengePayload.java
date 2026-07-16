package net.yayokorea.auth.fabric;

import java.util.Arrays;

import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;

public record AuthChallengePayload(byte[] challenge) implements CustomPacketPayload {
    public static final Type<AuthChallengePayload> TYPE = new Type<>(Identifier.fromNamespaceAndPath("yayo", "auth_challenge"));
    public static final StreamCodec<FriendlyByteBuf, AuthChallengePayload> CODEC = CustomPacketPayload.codec(
        AuthChallengePayload::write,
        AuthChallengePayload::new
    );

    public AuthChallengePayload {
        if (challenge.length != 32) {
            throw new IllegalArgumentException("Authentication challenge must be 32 bytes.");
        }
        challenge = Arrays.copyOf(challenge, challenge.length);
    }

    private AuthChallengePayload(FriendlyByteBuf buffer) {
        this(readBytes(buffer));
    }

    private void write(FriendlyByteBuf buffer) {
        buffer.writeBytes(challenge);
    }

    private static byte[] readBytes(FriendlyByteBuf buffer) {
        byte[] value = new byte[32];
        buffer.readBytes(value);
        return value;
    }

    @Override
    public Type<? extends CustomPacketPayload> type() {
        return TYPE;
    }
}
