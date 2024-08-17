import pygame
import random
import time

def pong_game():
    # Initialize Pygame
    pygame.init()

    # Set up the game window
    WIDTH = 800
    HEIGHT = 600
    window = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Pong")

    # Colors
    WHITE = (255, 255, 255)
    BLACK = (0, 0, 0)

    # Paddle settings
    PADDLE_WIDTH = 15
    PADDLE_HEIGHT = 90
    PADDLE_SPEED = 5

    # Ball settings
    BALL_SIZE = 15
    BALL_SPEED_X = 7
    BALL_SPEED_Y = 7

    # Create paddles and ball
    player = pygame.Rect(50, 0, PADDLE_WIDTH, HEIGHT)
    opponent = pygame.Rect(WIDTH - 50 - PADDLE_WIDTH, HEIGHT//2 - PADDLE_HEIGHT//2, PADDLE_WIDTH, PADDLE_HEIGHT)
    ball = pygame.Rect(WIDTH//2 - BALL_SIZE//2, HEIGHT//2 - BALL_SIZE//2, BALL_SIZE, BALL_SIZE)

    # Set up the game clock
    clock = pygame.time.Clock()

    # Ball movement
    ball_dx = BALL_SPEED_X * random.choice((1, -1))
    ball_dy = BALL_SPEED_Y * random.choice((1, -1))

    # Score
    player_score = 0
    opponent_score = 0
    opponent_send_back = 0

    # Font for score display
    font = pygame.font.Font(None, 36)

    # New variables for opponent's delayed reaction
    last_update_time = time.time()
    opponent_ball = opponent.y

    def reset_ball():
        ball.center = (WIDTH//2, HEIGHT//2)
        return BALL_SPEED_X * random.choice((1, -1)), BALL_SPEED_Y * random.choice((1, -1))

    # Game loop
    running = True
    while running:
        keys = pygame.key.get_pressed()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
        if keys[pygame.K_ESCAPE]:
            running = False

        # Move the player's paddle
        if keys[pygame.K_w] and player.top > 0:
            player.y -= PADDLE_SPEED
        if keys[pygame.K_s] and player.bottom < HEIGHT:
            player.y += PADDLE_SPEED

        # Update opponent's target position every second
        current_time = time.time()
        if current_time - last_update_time >= 1:
            opponent_ball = ball.centery
            last_update_time = current_time

        # Move the opponent's paddle (simple AI)
        if opponent.centery < opponent_ball and opponent.bottom < HEIGHT:
            opponent.y += PADDLE_SPEED
        elif opponent.centery > opponent_ball and opponent.top > 0:
            opponent.y -= PADDLE_SPEED

        # Move the ball
        ball.x += ball_dx
        ball.y += ball_dy

        # Ball collision with top and bottom
        if ball.top <= 0 or ball.bottom >= HEIGHT:
            ball_dy *= -1

        # Ball collision with paddles
        if ball_dx < 0 and player.right >= ball.left and player.top <= ball.centery <= player.bottom:
            if ball.left > player.left:
                ball.left = player.right
                ball_dx *= -1
        elif ball_dx > 0 and opponent.left <= ball.right and opponent.top <= ball.centery <= opponent.bottom:
            if ball.right < opponent.right:
                ball.right = opponent.left
                ball_dx *= -1

        # Ball out of bounds
        if ball.left <= 0:
            opponent_score += 1
            ball_dx, ball_dy = reset_ball()
        elif ball.right >= WIDTH:
            player_score += 1
            ball_dx, ball_dy = reset_ball()

        # End the game
        if player_score >= 10:
            running = False

        # Clear the screen
        window.fill(BLACK)

        # Draw paddles and ball
        pygame.draw.rect(window, WHITE, player)
        pygame.draw.rect(window, WHITE, opponent)
        pygame.draw.ellipse(window, WHITE, ball)

        # Draw scores
        player_text = font.render(str(player_score), True, WHITE)
        opponent_text = font.render(str(opponent_score), True, WHITE)
        window.blit(player_text, (WIDTH//4, 20))
        window.blit(opponent_text, (3*WIDTH//4, 20))

        # Draw the center line
        pygame.draw.aaline(window, WHITE, (WIDTH//2, 0), (WIDTH//2, HEIGHT))

        # Update the display
        pygame.display.flip()

        # Cap the frame rate
        clock.tick(60)

    # Quit the game
    pygame.quit()

    # Return the opponent's score
    return opponent_send_back

# Run the game and get the opponent's score
final_opponent_send_back = pong_game()
print(f"The opponent send back the ball {final_opponent_send_back} times")