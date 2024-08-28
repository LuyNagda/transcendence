import pygame, random, time
import numpy as np
from utils import opponent_ball, reset_ball, WIDTH, HEIGHT, AI_DELAY, MAX_SCORE, MAX_FRAME_RATE, WHITE, BLACK, PADDLE_HEIGHT, PADDLE_SPEED, PADDLE_WIDTH, BALL_SIZE, BALL_SPEED_X,BALL_SPEED_Y

def AI_neurons(ai, X):
    ai.layer1.forward(X)
    ai.activation1.forward(ai.layer1.output)

    ai.activation2.forward(ai.activation1.output)
    ai_response = np.argmax(ai.activation2.output)

    return ai_response

def AI_decision(ai, opponent, ai_ball, HEIGHT):
    X = [ai_ball.x / HEIGHT, ai_ball.y / HEIGHT, ai_ball.dx, ai_ball.dy, opponent.y]
    return AI_neurons(ai, X)

def pong_game(Ai_selected, SHOW_MATCH):
    # Initialize Pygame
    pygame.init()

    if SHOW_MATCH == "yes":
        window = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Pong")

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

    # Font for score display
    font = pygame.font.Font(None, 36)

    # New variables for opponent's delayed reaction
    last_update_time = time.time()

    # Game loop
    running = True
    while running:
        i = 0
        if i > (15 * 60 * 60):
            break
        i += 1

        keys = pygame.key.get_pressed()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return "STOP"
        if keys[pygame.K_ESCAPE]:
            pygame.quit()
            return "STOP"

        # Move the player's paddle
        if keys[pygame.K_w] and player.top > 0:
            player.y -= PADDLE_SPEED
        if keys[pygame.K_s] and player.bottom < HEIGHT:
            player.y += PADDLE_SPEED

        # Update opponent's target position every second
        ai_ball = opponent_ball()

        if (AI_DELAY == "yes"):
            current_time = time.time()
            if current_time - last_update_time >= 1:
                ai_ball.x = ball.x
                ai_ball.y = ball.y
                ai_ball.dx = ball_dx
                ai_ball.dy = ball_dy
                last_update_time = current_time
        
        else:
            ai_ball.x = ball.x
            ai_ball.y = ball.y
            ai_ball.dx = ball_dx
            ai_ball.dy = ball_dy

        # Move the opponent's paddle (simple AI)
        match (AI_decision(Ai_selected, opponent, ai_ball, HEIGHT)):
            case 0:
                if opponent.top > 0:
                    opponent.y -= PADDLE_SPEED
            case 1:
                pass
            case 2:
                if opponent.bottom < HEIGHT:
                    opponent.y += PADDLE_SPEED

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
                Ai_selected.ai_score += 1

        # Ball out of bounds
        if ball.left <= 0:
            opponent_score += 1
            ball_dx, ball_dy = reset_ball(ball)
        elif ball.right >= WIDTH:
            player_score += 1
            ball_dx, ball_dy = reset_ball(ball)

        # End the game
        if player_score >= MAX_SCORE:
            running = False

        if SHOW_MATCH == "yes":
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

    # Quit the game
    pygame.quit()

def play_Ai(Ai, demo):
    # Initialize Pygame
    pygame.init()

    window = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Pong")

    # Create paddles and ball
    player = pygame.Rect(50, HEIGHT//2 - PADDLE_HEIGHT//2, PADDLE_WIDTH, PADDLE_HEIGHT)
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

    # Font for score display
    font = pygame.font.Font(None, 36)

    # New variables for opponent's delayed reaction
    last_update_time = time.time()

    # Game loop
    running = True
    while running:
        keys = pygame.key.get_pressed()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return "STOP"
        if keys[pygame.K_ESCAPE]:
            pygame.quit()
            return "STOP"

        # Update opponent's target position every second
        ai_ball = opponent_ball()
        ai2_ball = opponent_ball()

        if (AI_DELAY == "yes"):
            current_time = time.time()
            if current_time - last_update_time >= 1:
                ai_ball.x = ball.x
                ai_ball.y = ball.y
                ai_ball.dx = ball_dx
                ai_ball.dy = ball_dy

                ai2_ball.x = WIDTH - ball.x
                ai2_ball.y = ball.y
                ai2_ball.dx = ball_dx * -1
                ai2_ball.dy = ball_dy

                last_update_time = current_time
        
        else:
            ai_ball.x = ball.x
            ai_ball.y = ball.y
            ai_ball.dx = ball_dx
            ai_ball.dy = ball_dy

            ai2_ball.x = WIDTH - ball.x
            ai2_ball.y = ball.y
            ai2_ball.dx = ball_dx * -1
            ai2_ball.dy = ball_dy

        # Move the player's paddle by AI
        if (demo == "yes"):
            match (AI_decision(Ai, opponent, ai2_ball, HEIGHT)):
                case 0:
                    if player.top > 0:
                        player.y -= PADDLE_SPEED
                case 1:
                    pass
                case 2:
                    if player.bottom < HEIGHT:
                        player.y += PADDLE_SPEED
        # Move the player's paddle with keyboard inputs
        else:
            if keys[pygame.K_w] and player.top > 0:
                player.y -= PADDLE_SPEED
            if keys[pygame.K_s] and player.bottom < HEIGHT:
                player.y += PADDLE_SPEED

        # Move the opponent's paddle
        match (AI_decision(Ai, opponent, ai_ball, HEIGHT)):
            case 0:
                if opponent.top > 0:
                    opponent.y -= PADDLE_SPEED
            case 1:
                pass
            case 2:
                if opponent.bottom < HEIGHT:
                    opponent.y += PADDLE_SPEED

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
            ball_dx, ball_dy = reset_ball(ball)
        elif ball.right >= WIDTH:
            player_score += 1
            ball_dx, ball_dy = reset_ball(ball)

        # End the game
        if player_score >= MAX_SCORE:
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

        if (MAX_FRAME_RATE != 0):
            clock.tick(MAX_FRAME_RATE)

    # Quit the game
    pygame.quit()
