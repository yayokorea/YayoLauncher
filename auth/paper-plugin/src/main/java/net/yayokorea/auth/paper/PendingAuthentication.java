package net.yayokorea.auth.paper;

import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;

import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitTask;

final class PendingAuthentication {
    final byte[] challenge;
    final AtomicBoolean verifying = new AtomicBoolean(false);
    final boolean originalInvulnerable;
    final boolean originalCollidable;
    final boolean originalInvisible;
    BukkitTask timeoutTask;

    PendingAuthentication(byte[] challenge, Player player) {
        this.challenge = Arrays.copyOf(challenge, challenge.length);
        this.originalInvulnerable = player.isInvulnerable();
        this.originalCollidable = player.isCollidable();
        this.originalInvisible = player.isInvisible();
    }
}
