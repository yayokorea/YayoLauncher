package net.yayokorea.auth.paper;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.GameMode;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.EntityPickupItemEvent;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryOpenEvent;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerGameModeChangeEvent;
import org.bukkit.event.player.PlayerInteractEntityEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerSwapHandItemsEvent;
import org.bukkit.event.player.PlayerToggleFlightEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.plugin.messaging.PluginMessageListener;

public final class YayoAuthPlugin extends JavaPlugin implements Listener, PluginMessageListener {
    static final String CHALLENGE_CHANNEL = "yayo:auth_challenge";
    static final String RESPONSE_CHANNEL = "yayo:auth_response";
    static final int RESPONSE_BYTES = 65;
    static final int PROTOCOL_VERSION = 1;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<UUID, PendingAuthentication> pending = new ConcurrentHashMap<>();
    private TicketApiClient ticketApi;
    private Component kickMessage;
    private long timeoutTicks;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        String serverId = getConfig().getString("server-id", "");
        String apiUrl = getConfig().getString("ticket-api-url", "");
        String serviceToken = getConfig().getString("paper-service-token", "");
        timeoutTicks = getConfig().getLong("authentication-timeout-ticks", 200L);
        kickMessage = Component.text(getConfig().getString("kick-message", "YayoLauncher authentication failed."));
        if (!Bukkit.getOnlineMode()) {
            throw new IllegalStateException("YayoAuth requires server.properties online-mode=true.");
        }
        if (!serverId.matches("[A-Za-z0-9._-]{1,128}") || timeoutTicks < 20L || serviceToken.startsWith("change-me")) {
            throw new IllegalStateException("YayoAuth config.yml contains an invalid server ID, timeout, or service token.");
        }
        ticketApi = new TicketApiClient(apiUrl, serviceToken, serverId);

        Bukkit.getPluginManager().registerEvents(this, this);
        Bukkit.getMessenger().registerOutgoingPluginChannel(this, CHALLENGE_CHANNEL);
        Bukkit.getMessenger().registerIncomingPluginChannel(this, RESPONSE_CHANNEL, this);
        for (Player player : Bukkit.getOnlinePlayers()) {
            beginAuthentication(player);
        }
    }

    @Override
    public void onDisable() {
        for (Player player : Bukkit.getOnlinePlayers()) {
            PendingAuthentication state = pending.remove(player.getUniqueId());
            if (state != null) {
                restorePlayer(player, state);
                player.kick(kickMessage);
            }
        }
        pending.clear();
        Bukkit.getMessenger().unregisterIncomingPluginChannel(this);
        Bukkit.getMessenger().unregisterOutgoingPluginChannel(this);
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onJoin(PlayerJoinEvent event) {
        event.joinMessage(null);
        beginAuthentication(event.getPlayer());
    }

    private void beginAuthentication(Player player) {
        byte[] challenge = new byte[32];
        secureRandom.nextBytes(challenge);
        PendingAuthentication state = new PendingAuthentication(challenge, player);
        pending.put(player.getUniqueId(), state);
        quarantine(player);

        for (Player other : Bukkit.getOnlinePlayers()) {
            if (!other.equals(player)) {
                other.hidePlayer(this, player);
                player.hidePlayer(this, other);
            }
        }

        state.timeoutTask = Bukkit.getScheduler().runTaskLater(this, () -> deny(player, state), timeoutTicks);
        Bukkit.getScheduler().runTask(this, () -> {
            if (pending.get(player.getUniqueId()) == state && player.isOnline()) {
                player.sendPluginMessage(this, CHALLENGE_CHANNEL, state.challenge);
            }
        });
    }

    @Override
    public void onPluginMessageReceived(String channel, Player player, byte[] message) {
        if (!RESPONSE_CHANNEL.equals(channel) || message.length != RESPONSE_BYTES || message[0] != PROTOCOL_VERSION) {
            return;
        }
        PendingAuthentication state = pending.get(player.getUniqueId());
        if (state == null || !state.verifying.compareAndSet(false, true)) {
            return;
        }

        byte[] ticket = new byte[32];
        byte[] receivedChallenge = new byte[32];
        System.arraycopy(message, 1, ticket, 0, 32);
        System.arraycopy(message, 33, receivedChallenge, 0, 32);
        if (!MessageDigest.isEqual(state.challenge, receivedChallenge)) {
            deny(player, state);
            return;
        }

        ticketApi.consume(ticket, player.getUniqueId(), receivedChallenge)
            .exceptionally(error -> {
                getLogger().warning("Ticket API request failed: " + error.getMessage());
                return false;
            })
            .thenAccept(valid -> Bukkit.getScheduler().runTask(this, () -> {
                if (valid) {
                    allow(player, state);
                } else {
                    deny(player, state);
                }
            }));
    }

    private void quarantine(Player player) {
        player.setInvulnerable(true);
        player.setCollidable(false);
        player.setInvisible(true);
    }

    private void allow(Player player, PendingAuthentication state) {
        if (!pending.remove(player.getUniqueId(), state) || !player.isOnline()) {
            return;
        }
        state.timeoutTask.cancel();
        restorePlayer(player, state);
        player.teleportAsync(player.getWorld().getSpawnLocation());
        for (Player other : Bukkit.getOnlinePlayers()) {
            if (!other.equals(player) && !pending.containsKey(other.getUniqueId())) {
                other.showPlayer(this, player);
                player.showPlayer(this, other);
            }
        }
    }

    private void deny(Player player, PendingAuthentication state) {
        if (!pending.remove(player.getUniqueId(), state)) {
            return;
        }
        if (state.timeoutTask != null) {
            state.timeoutTask.cancel();
        }
        if (player.isOnline()) {
            restorePlayer(player, state);
            player.kick(kickMessage);
        }
    }

    private void restorePlayer(Player player, PendingAuthentication state) {
        player.setInvulnerable(state.originalInvulnerable);
        player.setCollidable(state.originalCollidable);
        player.setInvisible(state.originalInvisible);
        for (Player other : Bukkit.getOnlinePlayers()) {
            if (!other.equals(player)) {
                other.showPlayer(this, player);
                player.showPlayer(this, other);
            }
        }
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        PendingAuthentication state = pending.remove(event.getPlayer().getUniqueId());
        if (state != null && state.timeoutTask != null) {
            state.timeoutTask.cancel();
        }
    }

    private boolean isPending(Entity entity) {
        return entity instanceof Player player && pending.containsKey(player.getUniqueId());
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        if (isPending(event.getPlayer()) && (event.getFrom().getX() != event.getTo().getX()
            || event.getFrom().getY() != event.getTo().getY() || event.getFrom().getZ() != event.getTo().getZ())) {
            event.setCancelled(true);
        }
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent event) { if (isPending(event.getPlayer())) event.setCancelled(true); }
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onChat(AsyncChatEvent event) { if (isPending(event.getPlayer())) event.setCancelled(true); }
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onInteract(PlayerInteractEvent event) { if (isPending(event.getPlayer())) event.setCancelled(true); }
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onInteractEntity(PlayerInteractEntityEvent event) { if (isPending(event.getPlayer())) event.setCancelled(true); }
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onInventoryClick(InventoryClickEvent event) { if (isPending(event.getWhoClicked())) event.setCancelled(true); }
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onInventoryOpen(InventoryOpenEvent event) { if (isPending(event.getPlayer())) event.setCancelled(true); }
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onDrop(PlayerDropItemEvent event) { if (isPending(event.getPlayer())) event.setCancelled(true); }
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onPickup(EntityPickupItemEvent event) { if (isPending(event.getEntity())) event.setCancelled(true); }
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onBreak(BlockBreakEvent event) { if (isPending(event.getPlayer())) event.setCancelled(true); }
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onPlace(BlockPlaceEvent event) { if (isPending(event.getPlayer())) event.setCancelled(true); }
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onGameMode(PlayerGameModeChangeEvent event) { if (isPending(event.getPlayer())) event.setCancelled(true); }
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onFlight(PlayerToggleFlightEvent event) { if (isPending(event.getPlayer())) event.setCancelled(true); }
    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onSwapHands(PlayerSwapHandItemsEvent event) { if (isPending(event.getPlayer())) event.setCancelled(true); }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onDamage(EntityDamageEvent event) {
        if (isPending(event.getEntity())) {
            event.setCancelled(true);
        }
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onDamageByEntity(EntityDamageByEntityEvent event) {
        Entity damager = event.getDamager();
        boolean pendingDamager = isPending(damager)
            || damager instanceof Projectile projectile && projectile.getShooter() instanceof Player player && isPending(player);
        if (pendingDamager || isPending(event.getEntity())) {
            event.setCancelled(true);
        }
    }
}
