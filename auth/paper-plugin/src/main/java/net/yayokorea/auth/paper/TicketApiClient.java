package net.yayokorea.auth.paper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

final class TicketApiClient {
    private final HttpClient httpClient;
    private final URI consumeUri;
    private final String serviceToken;
    private final String serverId;

    TicketApiClient(String apiBaseUrl, String serviceToken, String serverId) {
        URI baseUri = URI.create(apiBaseUrl);
        boolean localDevelopment = "http".equals(baseUri.getScheme()) && "127.0.0.1".equals(baseUri.getHost());
        if (!"https".equals(baseUri.getScheme()) && !localDevelopment) {
            throw new IllegalArgumentException("ticket-api-url must use HTTPS (HTTP is allowed only for 127.0.0.1). ");
        }
        if (serviceToken.length() < 32) {
            throw new IllegalArgumentException("paper-service-token must contain at least 32 characters.");
        }
        this.consumeUri = URI.create(apiBaseUrl.replaceAll("/$", "") + "/v1/tickets/consume");
        this.serviceToken = serviceToken;
        this.serverId = serverId;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    }

    CompletableFuture<Boolean> consume(byte[] ticket, UUID uuid, byte[] challenge) {
        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        String normalizedUuid = uuid.toString().replace("-", "").toLowerCase();
        String body = "{\"ticket\":\"" + encoder.encodeToString(ticket)
            + "\",\"uuid\":\"" + normalizedUuid
            + "\",\"serverId\":\"" + escapeJson(serverId)
            + "\",\"challenge\":\"" + encoder.encodeToString(challenge) + "\"}";
        HttpRequest request = HttpRequest.newBuilder(consumeUri)
            .timeout(Duration.ofSeconds(5))
            .header("Authorization", "Bearer " + serviceToken)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
            .thenApply(response -> response.statusCode() == 200 && response.body().matches("\\s*\\{\\s*\"valid\"\\s*:\\s*true\\s*}\\s*"));
    }

    private static String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
