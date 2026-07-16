package net.yayokorea.auth.fabric;

import java.util.Arrays;

import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;

public record AuthResponsePayload(byte[] ticket, byte[] challenge) implements CustomPacketPayload {
    public static final int PROTOCOL_VERSION = 1;
    public static final Type<AuthResponsePayload> TYPE = new Type<>(Identifier.fromNamespaceAndPath("yayo", "auth_response"));
    public static final StreamCodec<FriendlyByteBuf, AuthResponsePayload> CODEC = CustomPacketPayload.codec(
        AuthResponsePayload::write,
        AuthResponsePayload::new
    );

    public AuthResponsePayload {
        if (ticket.length != 32 || challenge.length != 32) {
            throw new IllegalArgumentException("Authentication response fields must be 32 bytes.");
        }
        ticket = Arrays.copyOf(ticket, ticket.length);
        challenge = Arrays.copyOf(challenge, challenge.length);
    }

    private AuthResponsePayload(FriendlyByteBuf buffer) {
        this(readAndValidateVersion(buffer), readBytes(buffer));
    }

    private void write(FriendlyByteBuf buffer) {
        buffer.writeByte(PROTOCOL_VERSION);
        buffer.writeBytes(ticket);
        buffer.writeBytes(challenge);
    }

    private static byte[] readAndValidateVersion(FriendlyByteBuf buffer) {
        if (buffer.readUnsignedByte() != PROTOCOL_VERSION) {
            throw new IllegalArgumentException("Unsupported Yayo authentication protocol.");
        }
        return readBytes(buffer);
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
