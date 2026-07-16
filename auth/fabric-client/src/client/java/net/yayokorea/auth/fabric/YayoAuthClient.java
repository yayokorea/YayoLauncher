package net.yayokorea.auth.fabric;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;

public final class YayoAuthClient implements ClientModInitializer {
    private static final Logger LOGGER = LoggerFactory.getLogger("yayo-auth");
    private static final Pattern TICKET_PATTERN = Pattern.compile("\\\"ticket\\\"\\s*:\\s*\\\"([A-Za-z0-9_-]{43})\\\"");
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(2))
        .build();

    private URI brokerUri;
    private String brokerSecret;
    private String serverId;

    @Override
    public void onInitializeClient() {
        loadBrokerConfiguration();
        ClientPlayNetworking.registerGlobalReceiver(AuthChallengePayload.TYPE, (payload, context) -> {
            if (brokerUri == null) {
                LOGGER.warn("Yayo authentication challenge received without a launcher ticket broker.");
                return;
            }
            requestTicket(payload.challenge()).whenComplete((ticket, error) -> {
                if (error != null) {
                    LOGGER.warn("Unable to obtain a Yayo server ticket: {}", error.getMessage());
                    return;
                }
                context.client().execute(() -> {
                    if (ClientPlayNetworking.canSend(AuthResponsePayload.TYPE)) {
                        ClientPlayNetworking.send(new AuthResponsePayload(ticket, payload.challenge()));
                    }
                });
            });
        });
    }

    private void loadBrokerConfiguration() {
        String url = System.getenv("YAYO_AUTH_BROKER_URL");
        brokerSecret = System.getenv("YAYO_AUTH_BROKER_SECRET");
        serverId = System.getenv("YAYO_AUTH_SERVER_ID");
        if (url == null || brokerSecret == null || serverId == null) {
            return;
        }

        URI uri = URI.create(url);
        if (!"http".equals(uri.getScheme()) || !"127.0.0.1".equals(uri.getHost()) || uri.getPort() < 1) {
            LOGGER.error("Rejected unsafe Yayo ticket broker URL.");
            brokerSecret = null;
            serverId = null;
            return;
        }
        brokerUri = uri.resolve("/v1/tickets");
    }

    private java.util.concurrent.CompletableFuture<byte[]> requestTicket(byte[] challenge) {
        String encodedChallenge = Base64.getUrlEncoder().withoutPadding().encodeToString(challenge);
        String body = "{\"serverId\":\"" + serverId + "\",\"challenge\":\"" + encodedChallenge + "\"}";
        HttpRequest request = HttpRequest.newBuilder(brokerUri)
            .timeout(Duration.ofSeconds(8))
            .header("Authorization", "Bearer " + brokerSecret)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();

        return HTTP_CLIENT.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
            .thenApply(response -> {
                if (response.statusCode() != 200) {
                    throw new IllegalStateException("ticket broker returned HTTP " + response.statusCode());
                }
                Matcher matcher = TICKET_PATTERN.matcher(response.body());
                if (!matcher.find()) {
                    throw new IllegalStateException("ticket broker returned malformed JSON");
                }
                byte[] ticket = Base64.getUrlDecoder().decode(matcher.group(1));
                if (ticket.length != 32) {
                    throw new IllegalStateException("ticket broker returned an invalid ticket");
                }
                return ticket;
            });
    }
}
